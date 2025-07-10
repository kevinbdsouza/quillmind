import { json, error } from '../utils';
import { query } from '../../../api/dbConfig';
import axios from 'axios';
import { getVectorStore } from '../services/cloudflareKVVectorStore';

// Simple UUID generation function
const generateId = () => {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
};

/**
 * File Creation Agent - Handles file operations (create, delete, rename)
 * and specialized book structure creation
 */
export const handleFileCreationRequest = async (body, env, user) => {
    const { action, projectId, ...params } = body;
    
    if (!projectId) {
        return error(400, { message: 'Project ID is required for file operations.' });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in the environment variables.');
        return error(500, { message: 'AI service configuration error.' });
    }

    console.log(`[File Creation Agent] Processing ${action} request for project ${projectId}`);

    try {
        switch (action) {
            case 'create_file':
                return await createFile(params, projectId, env);
            case 'delete_file':
                return await deleteFile(params, projectId, env);
            case 'rename_file':
                return await renameFile(params, projectId, env);
            case 'create_book_structure':
                return await createBookStructure(params, projectId, env, apiKey);
            default:
                return error(400, { message: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error(`[File Creation Agent] Error:`, err.message);
        return error(500, { 
            message: 'An error occurred while processing your file operation request.',
            details: err.message 
        });
    }
};

/**
 * Create a single file
 */
const createFile = async (params, projectId, env) => {
    const { name, type = 'file', parent_id = null, content = '' } = params;
    
    if (!name) {
        return error(400, { message: 'File name is required.' });
    }

    try {
        // Insert the file into the database
        const result = await query(
            'INSERT INTO files (name, type, parent_id, project_id, content) VALUES (?, ?, ?, ?, ?) RETURNING file_id, project_id, parent_id, name, type, created_at, updated_at',
            [name, type, parent_id, projectId, content],
            env
        );

        const fileId = result.rows[0].file_id;
        
        // Return the created file
        const createdFile = {
            file_id: fileId,
            name,
            type,
            parent_id,
            project_id: projectId,
            content
        };

        return json({
            result: `Successfully created ${type}: ${name}`,
            file: createdFile
        });
    } catch (err) {
        console.error('[File Creation Agent] Error creating file:', err.message);
        return error(500, { message: 'Failed to create file.' });
    }
};

/**
 * Delete a file
 */
const deleteFile = async (params, projectId, env) => {
    const { fileId } = params;
    
    if (!fileId) {
        return error(400, { message: 'File ID is required for deletion.' });
    }

    try {
        // Delete the file from the database
        await query(
            'DELETE FROM files WHERE file_id = ? AND project_id = ?',
            [fileId, projectId],
            env
        );

        return json({
            result: `Successfully deleted file with ID: ${fileId}`
        });
    } catch (err) {
        console.error('[File Creation Agent] Error deleting file:', err.message);
        return error(500, { message: 'Failed to delete file.' });
    }
};

/**
 * Rename a file
 */
const renameFile = async (params, projectId, env) => {
    const { fileId, newName } = params;
    
    if (!fileId || !newName) {
        return error(400, { message: 'File ID and new name are required for renaming.' });
    }

    try {
        // Update the file name in the database
        await query(
            'UPDATE files SET name = ? WHERE file_id = ? AND project_id = ?',
            [newName, fileId, projectId],
            env
        );

        return json({
            result: `Successfully renamed file to: ${newName}`
        });
    } catch (err) {
        console.error('[File Creation Agent] Error renaming file:', err.message);
        return error(500, { message: 'Failed to rename file.' });
    }
};

/**
 * Create book structure with all necessary files
 */
const createBookStructure = async (params, projectId, env, apiKey) => {
    const { numberOfChapters, bookTitle, storyGoal } = params;
    
    if (!numberOfChapters || !bookTitle || !storyGoal) {
        return error(400, { message: 'Number of chapters, book title, and story goal are required.' });
    }

    console.log(`[Book Structure] Creating book structure: ${numberOfChapters} chapters, title: "${bookTitle}", goal: "${storyGoal}"`);

    try {
        // Define the files to create
        const filesToCreate = [
            'prologue.md',
            ...Array.from({ length: numberOfChapters }, (_, i) => `chapter_${i + 1}.md`),
            'epilogue.md',
            'author_bio.md'
        ];

        // Check which files already exist
        const existingFiles = await checkExistingFiles(filesToCreate, projectId, env);
        const filesToActuallyCreate = filesToCreate.filter(fileName => !existingFiles.includes(fileName));

        console.log(`[Book Structure] Files to create: ${filesToActuallyCreate.join(', ')}`);
        console.log(`[Book Structure] Files already exist: ${existingFiles.join(', ')}`);

        // Generate content for each file first, then create files with the content
        console.log(`[Book Structure] Starting content generation for ${filesToActuallyCreate.length} files`);
        
        // Get all existing files in the project for context
        const allProjectFiles = await query(
            'SELECT file_id, name, content FROM files WHERE project_id = ? AND type = "file"',
            [projectId],
            env
        );

        const createdFiles = [];
        const suggestions = [];
        
        for (const fileName of filesToActuallyCreate) {
            try {
                // Create empty file first
                const result = await query(
                    'INSERT INTO files (name, type, parent_id, project_id, content) VALUES (?, ?, ?, ?, ?) RETURNING file_id, project_id, parent_id, name, type, created_at, updated_at',
                    [fileName, 'file', null, projectId, ''],
                    env
                );

                const fileId = result.rows[0].file_id;
                const newFile = {
                    file_id: fileId,
                    name: fileName,
                    type: 'file',
                    parent_id: null,
                    project_id: projectId,
                    content: ''
                };
                
                createdFiles.push(newFile);
                console.log(`[Book Structure] Successfully created empty file ${fileName}`);
                
                // Generate content for suggestion
                const tempFile = { name: fileName };
                const content = await generateFileContent(tempFile, bookTitle, storyGoal, allProjectFiles.rows, apiKey, env, projectId);
                
                if (content && content.trim()) {
                    // Create inline suggestion for the new content
                    suggestions.push({
                        id: generateId(),
                        fileName: fileName,
                        fileId: fileId,
                        file_id: fileId, // Also include with underscore for compatibility
                        content: content,
                        type: 'full_content_suggestion',
                        // Convert to inline suggestion format
                        originalRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                        suggestionRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                        deleteRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                        text: content
                    });
                    
                    console.log(`[Book Structure] Generated content suggestion for ${fileName}: ${content.length} characters`);
                }
                
            } catch (err) {
                console.error(`[Book Structure] Error creating file ${fileName}:`, err.message);
                // Create file without content as fallback
                try {
                    const result = await query(
                        'INSERT INTO files (name, type, parent_id, project_id, content) VALUES (?, ?, ?, ?, ?) RETURNING file_id, project_id, parent_id, name, type, created_at, updated_at',
                        [fileName, 'file', null, projectId, ''],
                        env
                    );
                    
                    const fileId = result.rows[0].file_id;
                    createdFiles.push({
                        file_id: fileId,
                        name: fileName,
                        type: 'file',
                        parent_id: null,
                        project_id: projectId,
                        content: ''
                    });
                } catch (fallbackErr) {
                    console.error(`[Book Structure] Failed to create file ${fileName} even as fallback:`, fallbackErr.message);
                }
            }
        }

        // Generate suggestions for existing files with content
        console.log(`[Book Structure] Generating suggestions for ${existingFiles.length} existing files`);
        const existingFilesSuggestions = await generateExistingFilesSuggestions(
            existingFiles, projectId, bookTitle, storyGoal, allProjectFiles.rows, apiKey, env
        );
        
        const allSuggestions = [...suggestions, ...existingFilesSuggestions];
        console.log(`[Book Structure] Total suggestions generated: ${allSuggestions.length}`);
        console.log(`[Book Structure] Suggestions breakdown:`, allSuggestions.map(s => ({
            fileName: s.fileName,
            type: s.type,
            hasOldContent: !!s.oldContentFull,
            hasNewContent: !!s.newContentFull
        })));

        return json({
            result: `Successfully created book structure with ${createdFiles.length} new files. ${existingFiles.length} files already existed.`,
            createdFiles,
            existingFiles,
            suggestions: allSuggestions,
            bookStructure: {
                title: bookTitle,
                goal: storyGoal,
                chapters: numberOfChapters,
                files: filesToCreate
            }
        });

    } catch (err) {
        console.error('[Book Structure] Error creating book structure:', err.message);
        return error(500, { message: 'Failed to create book structure.' });
    }
};

/**
 * Check which files already exist (including variations)
 */
const checkExistingFiles = async (filesToCreate, projectId, env) => {
    const existingFiles = [];
    
    for (const fileName of filesToCreate) {
        // Check for exact match
        const exactMatch = await query(
            'SELECT name FROM files WHERE name = ? AND project_id = ? AND type = "file"',
            [fileName, projectId],
            env
        );
        
        if (exactMatch.rows.length > 0) {
            existingFiles.push(fileName);
            continue;
        }

        // Check for variations (e.g., chapter1.md instead of chapter_1.md)
        const baseFileName = fileName.replace(/\.md$/, '');
        const variation = baseFileName.replace(/_/g, '');
        const variationFileName = `${variation}.md`;
        
        const variationMatch = await query(
            'SELECT name FROM files WHERE name = ? AND project_id = ? AND type = "file"',
            [variationFileName, projectId],
            env
        );
        
        if (variationMatch.rows.length > 0) {
            existingFiles.push(fileName);
        }
    }
    
    return existingFiles;
};

/**
 * Generate content for a specific file using AI with RAG context
 */
const generateFileContent = async (file, bookTitle, storyGoal, allProjectFiles, apiKey, env, projectId) => {
    const fileType = getFileType(file.name);
    
    // Use RAG to get relevant context
    let ragContext = '';
    try {
        const { getVectorStore } = await import('../services/vectorStoreService');
        const searchQuery = `${bookTitle} ${storyGoal} ${fileType} ${file.name}`;
        
        // Generate embedding for the search query
        const embeddingModel = 'text-embedding-004';
        const embeddingApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`;
        
        const embeddingRequestBody = {
            model: `models/${embeddingModel}`,
            content: {
                parts: [{ text: searchQuery }]
            },
            taskType: 'RETRIEVAL_QUERY'
        };
        
        const embeddingResponse = await axios.post(embeddingApiUrl, embeddingRequestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const queryVector = embeddingResponse.data.embedding.values;
        
        // Query the vector store
        const vectorStore = getVectorStore(env);
        const ragResults = await vectorStore.query(queryVector, {
            topK: 5,
            returnMetadata: true,
            projectId: projectId
        }, env);
        
        if (ragResults && ragResults.matches && ragResults.matches.length > 0) {
            // Get the actual content for the matched files
            const fileIds = ragResults.matches.map(match => match.metadata.fileId);
            const fileContents = await query(
                `SELECT file_id, name, content FROM files WHERE file_id IN (${fileIds.map(() => '?').join(', ')}) AND type = "file"`,
                fileIds,
                env
            );
            
            ragContext = fileContents.rows.map(file => 
                `File: ${file.name}\n---\n${file.content}\n---`
            ).join('\n\n');
            
            console.log(`[Book Structure] RAG found ${ragResults.matches.length} relevant files for ${file.name}`);
        }
    } catch (ragError) {
        console.warn(`[Book Structure] RAG search failed for ${file.name}:`, ragError.message);
    }
    
    // Fallback to direct file content if RAG fails
    const directContext = allProjectFiles
        .filter(f => f.name !== file.name && f.content.trim())
        .map(f => `File: ${f.name}\n---\n${f.content}\n---`)
        .join('\n\n');
    
    const contextText = ragContext || directContext || 'No other files with content yet.';

    const prompt = `You are a creative writing assistant helping to create a book structure.

Book Title: "${bookTitle}"
Story Goal: "${storyGoal}"
Current File: "${file.name}"
File Type: ${fileType}

Context from other files in the project:
${contextText}

Please generate ${fileType} content for "${file.name}". 
- For prologue/chapters/epilogue: Create a compelling story structure with placeholder content, scene descriptions, and character notes
- For author bio: Create a professional author biography template
- Keep the content substantial but leave room for the author to expand
- Use markdown formatting appropriately
- Make it engaging and aligned with the story goal

IMPORTANT: Generate ONLY the raw markdown content for this file. Do NOT wrap it in code blocks like \`\`\`markdown\`\`\`. Do NOT add any explanations or additional text outside the file content.

Content for ${file.name}:`;

    try {
        const model = 'gemini-1.5-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
            }
        };

        const response = await axios.post(apiUrl, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        let generatedContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean up any markdown code blocks that might have been generated
        generatedContent = generatedContent
            .replace(/^```markdown\s*\n?/i, '')
            .replace(/^```\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '')
            .trim();
        
        console.log(`[Book Structure] Generated content for ${file.name}: ${generatedContent.length} characters`);
        
        return generatedContent;
    } catch (err) {
        console.error(`[Book Structure] Error generating content for ${file.name}:`, err.message);
        return `# ${file.name.replace('.md', '').replace(/_/g, ' ').toUpperCase()}\n\n[Content to be written for ${bookTitle}]`;
    }
};

/**
 * Generate suggestions for existing files
 */
const generateExistingFilesSuggestions = async (existingFiles, projectId, bookTitle, storyGoal, allProjectFiles, apiKey, env) => {
    const suggestions = [];
    
    for (const fileName of existingFiles) {
        try {
            // Get the existing file content
            const fileData = await query(
                'SELECT file_id, name, content FROM files WHERE name = ? AND project_id = ? AND type = "file"',
                [fileName, projectId],
                env
            );
            
            if (fileData.rows.length === 0) continue;
            
            const file = fileData.rows[0];
            const fileType = getFileType(fileName);
            
            // Generate suggestions for improving the existing content
            const contextText = allProjectFiles
                .filter(f => f.name !== fileName && f.content.trim())
                .map(f => `File: ${f.name}\n---\n${f.content}\n---`)
                .join('\n\n');

            const prompt = `You are a creative writing assistant helping to enhance a book.

Book Title: "${bookTitle}"
Story Goal: "${storyGoal}"
Current File: "${fileName}"
File Type: ${fileType}

Current content of ${fileName}:
---
${file.content}
---

Context from other files:
${contextText || 'No other files with content yet.'}

Please provide 2-3 specific suggestions to improve this ${fileType} content to better align with the book's title and story goal. Focus on:
- Enhancing narrative flow
- Strengthening character development
- Improving scene descriptions
- Better alignment with the overall story goal

Format each suggestion as a brief improvement recommendation (1-2 sentences each).`;

            const model = 'gemini-1.5-flash';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            };

            const response = await axios.post(apiUrl, requestBody, {
                headers: { 'Content-Type': 'application/json' }
            });

            const suggestionText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            if (suggestionText) {
                // Format as edit suggestion that the frontend can understand
                suggestions.push({
                    id: generateId(),
                    fileName: fileName,
                    fileId: file.file_id,
                    file_id: file.file_id, // Also include with underscore for compatibility
                    oldContentFull: file.content,
                    newContentFull: `${file.content}\n\n<!-- AI Book Structure Suggestions -->\n${suggestionText}`,
                    type: 'edit_agent_suggestion', // This will be categorized as editAgentSuggestion
                    suggestionText: suggestionText,
                    occurrenceIndex: 0
                });
                
                console.log(`[Book Structure] Generated suggestions for existing file ${fileName}`);
            }
        } catch (err) {
            console.error(`[Book Structure] Error generating suggestions for ${fileName}:`, err.message);
        }
    }
    
    return suggestions;
};

/**
 * Determine file type based on filename
 */
const getFileType = (fileName) => {
    const name = fileName.toLowerCase();
    if (name.includes('prologue')) return 'prologue';
    if (name.includes('chapter')) return 'chapter';
    if (name.includes('epilogue')) return 'epilogue';
    if (name.includes('author') || name.includes('bio')) return 'author biography';
    return 'content';
}; 