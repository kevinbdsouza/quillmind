import { json, error } from '../utils';
import { query } from '../../../api/dbConfig';
import axios from 'axios';
import { getVectorStore } from '../services/cloudflareKVVectorStore';

// Simple UUID generation function to avoid external dependencies
const generateId = () => {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
};

/**
 * Main Edit Agent - Orchestrates the edit workflow through subagents
 * 
 * Workflow:
 * 1. File Discovery Agent - Find files that need editing
 * 2. Diff Generation Agent - Generate precise diffs for changes
 * 3. Diff Application Agent - Apply diffs as suggestions
 */
export const handleEditRequest = async (body, env, user) => {
    const { text, context, projectId, history } = body;
    
    if (!projectId) {
        return error(400, { message: 'Project ID is required for edit requests.' });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in the environment variables.');
        return error(500, { message: 'AI service configuration error.' });
    }

    console.log(`[Edit Agent] Processing edit request: "${text}" for project ${projectId}`);

    try {
        // Phase 1: File Discovery - Find which files need to be edited
        console.log('[Edit Agent] Phase 1: File Discovery');
        const discoveredFiles = await discoverFiles(text, context, projectId, env);
        
        if (discoveredFiles.length === 0) {
            return json({
                result: "I couldn't identify any files that need to be edited based on your request. Please specify which files you'd like me to modify or provide more context about the changes you want to make.",
                editSummary: {
                    phase: 'file_discovery',
                    filesFound: 0,
                    message: 'No files identified for editing'
                }
            });
        }

        console.log(`[Edit Agent] Found ${discoveredFiles.length} files for editing:`, discoveredFiles.map(f => f.name));

        // Phase 2: Diff Generation - Generate precise diffs for each file
        console.log('[Edit Agent] Phase 2: Diff Generation');
        const diffs = await generateDiffs(discoveredFiles, text, context, apiKey);

        if (diffs.length === 0) {
            return json({
                result: "I analyzed the relevant files but no changes were needed. This could mean the requested changes are already applied, or the query wasn't specific enough to identify what needs to be modified.",
                editSummary: {
                    phase: 'diff_generation',
                    filesFound: discoveredFiles.length,
                    diffsGenerated: 0,
                    message: 'No changes could be generated'
                }
            });
        }

        console.log(`[Edit Agent] Generated ${diffs.length} diffs`);

        // Phase 3: Diff Application - The frontend will handle this
        // We now return suggestions directly.

        // Filter files to only include those with actual edits
        const filesWithEdits = discoveredFiles.filter(file => 
            diffs.some(diff => diff.fileName === file.name)
        );

        // Generate summary response
        const summary = generateEditSummary(filesWithEdits, diffs);
        
        return json({
            result: summary.message,
            editSummary: summary,
            suggestions: diffs, // Return the processed diffs
            filesToOpen: filesWithEdits.map(f => ({
                file_id: f.file_id,
                name: f.name,
                content: f.content,
                type: f.type
            }))
        });

    } catch (err) {
        console.error(`[Edit Agent] Error:`, err.message);
        return error(500, { 
            message: 'An error occurred while processing your edit request.',
            details: err.message 
        });
    }
};

/**
 * Subagent 1: File Discovery
 * Identifies which files need to be edited based on the request
 */
const discoverFiles = async (editRequest, context, projectId, env) => {
    console.log('[File Discovery] Starting file discovery');
    
    const files = [];
    const fileNames = new Set(); // Track file names to avoid duplicates
    
    // First, check if files are explicitly provided in context
    if (context && context.files && context.files.length > 0) {
        console.log(`[File Discovery] Using ${context.files.length} files from context`);
        
        // Get file details from database
        for (const contextFile of context.files) {
            try {
                const fileResult = await query(
                    'SELECT file_id, name, content, type FROM files WHERE name = ? AND project_id = ? AND type = "file"',
                    [contextFile.fileName, projectId],
                    env
                );
                
                if (fileResult.rows.length > 0) {
                    files.push({
                        file_id: fileResult.rows[0].file_id,
                        name: fileResult.rows[0].name,
                        content: fileResult.rows[0].content,
                        type: fileResult.rows[0].type,
                        source: 'context'
                    });
                    fileNames.add(fileResult.rows[0].name);
                }
            } catch (error) {
                console.warn(`[File Discovery] Error fetching file ${contextFile.fileName}:`, error.message);
            }
        }
    }
    
    // Always use RAG to discover additional relevant files
    // This ensures the edit agent can work across the entire project
    console.log('[File Discovery] Using RAG to discover additional relevant files');
    const ragFiles = await discoverFilesWithRAG(editRequest, projectId, env);
    
    // Add RAG-discovered files that aren't already in the list
    ragFiles.forEach(ragFile => {
        if (!fileNames.has(ragFile.name)) {
            files.push(ragFile);
            fileNames.add(ragFile.name);
        }
    });
    
    console.log(`[File Discovery] Discovered ${files.length} files total`);
    console.log(`[File Discovery] Files: ${Array.from(fileNames).join(', ')}`);
    return files;
};

/**
 * Use RAG to discover files that might need editing
 */
const discoverFilesWithRAG = async (editRequest, projectId, env) => {
    try {
        console.log(`[RAG Discovery] Starting RAG search for: "${editRequest}" in project ${projectId}`);
        
        // Generate embedding for the edit request
        const apiKey = env.GEMINI_API_KEY;
        const embeddingModel = 'text-embedding-004';
        const embeddingApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`;

        const embeddingRequestBody = {
            model: `models/${embeddingModel}`,
            content: {
                parts: [{ text: editRequest }]
            },
            taskType: 'RETRIEVAL_QUERY'
        };

        const embeddingResponse = await axios.post(embeddingApiUrl, embeddingRequestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const queryVector = embeddingResponse.data.embedding.values;
        console.log(`[RAG Discovery] Generated embedding vector of length ${queryVector.length}`);

        // Query vector store for relevant files
        const index = getVectorStore(env);
        const vectorResponse = await index.query(queryVector, { topK: 10, returnMetadata: true, projectId }, env);
        
        console.log(`[RAG Discovery] Vector search returned ${vectorResponse.matches?.length || 0} matches`);
        
        const projectIdStr = String(projectId);
        const relevantFiles = vectorResponse.matches.filter(match => 
            match.metadata && String(match.metadata.projectId) === projectIdStr
        );

        console.log(`[RAG Discovery] Filtered to ${relevantFiles.length} files for project ${projectId}`);

        if (relevantFiles.length === 0) {
            console.log('[RAG Discovery] No relevant files found via RAG - checking if project is indexed');
            
            // Fallback: get all files from the project if RAG finds nothing
            const allFilesResult = await query(
                'SELECT file_id, name, content, type FROM files WHERE project_id = ? AND type = "file" ORDER BY name LIMIT 20',
                [projectId],
                env
            );
            
            console.log(`[RAG Discovery] Fallback: Found ${allFilesResult.rows.length} total files in project`);
            
            if (allFilesResult.rows.length === 0) {
                console.log('[RAG Discovery] No files found in project at all');
                return [];
            }
            
            // Return first few files as fallback
            return allFilesResult.rows.slice(0, 5).map(file => ({
                ...file,
                source: 'fallback'
            }));
        }

        // Fetch file contents from database
        const fileIds = relevantFiles.map(match => match.metadata.fileId);
        const placeholders = fileIds.map(() => '?').join(',');
        const filesResult = await query(
            `SELECT file_id, name, content, type FROM files WHERE file_id IN (${placeholders})`,
            fileIds,
            env
        );

        console.log(`[RAG Discovery] Successfully retrieved ${filesResult.rows.length} files from database`);
        filesResult.rows.forEach(file => {
            console.log(`[RAG Discovery] - ${file.name} (${file.content?.length || 0} chars)`);
            console.log(`[RAG Discovery] - Content preview: "${file.content?.substring(0, 100)}..."`);
        });

        return filesResult.rows.map(file => ({
            ...file,
            source: 'rag'
        }));

    } catch (error) {
        console.error('[RAG Discovery] RAG discovery failed:', error.message);
        console.error('[RAG Discovery] Full error:', error);
        
        // Final fallback: try to get some files directly
        try {
            const fallbackResult = await query(
                'SELECT file_id, name, content, type FROM files WHERE project_id = ? AND type = "file" ORDER BY name LIMIT 5',
                [projectId],
                env
            );
            
            console.log(`[RAG Discovery] Emergency fallback: Found ${fallbackResult.rows.length} files`);
            
            return fallbackResult.rows.map(file => ({
                ...file,
                source: 'emergency_fallback'
            }));
        } catch (fallbackError) {
            console.error('[RAG Discovery] Even fallback failed:', fallbackError.message);
            return [];
        }
    }
};

/**
 * Subagent 2: Diff Generation
 * Generates precise changes for a single file using an LLM.
 */
const generateDiffs = async (files, editRequest, context, apiKey) => {
    console.log('[Diff Generation] Starting diff generation');
    
    const allDiffs = [];
    
    for (const file of files) {
        try {
            const diffsForFile = await generateDiffForFile(file, editRequest, context, apiKey);
            if (diffsForFile && diffsForFile.length > 0) {
                // Add file context to each diff
                const diffsWithContext = diffsForFile.map(diff => ({
                    ...diff,
                    fileName: file.name,
                    fileId: file.file_id
                }));
                allDiffs.push(...diffsWithContext);
            }
        } catch (error) {
            console.error(`[Diff Generation] Error generating diff for ${file.name}:`, error.message);
        }
    }
    
    console.log(`[Diff Generation] Generated a total of ${allDiffs.length} diffs`);
    return allDiffs;
};

/**
 * Subagent 2b: Diff Minimization
 * Takes a raw diff (old/new content) and makes it as small as possible
 * while ensuring it's still uniquely identifiable in the original file.
 */
const minimizeDiff = (oldC, newC, context) => {
    let oldContent = String(oldC || '');
    let newContent = String(newC || '');
    
    // 1. Trim common prefix
    let prefixLen = 0;
    while (
        prefixLen < oldContent.length &&
        prefixLen < newContent.length &&
        oldContent[prefixLen] === newContent[prefixLen]
    ) {
        prefixLen++;
    }
    oldContent = oldContent.substring(prefixLen);
    newContent = newContent.substring(prefixLen);

    // 2. Trim common suffix
    let suffixLen = 0;
    while (
        suffixLen < oldContent.length &&
        suffixLen < newContent.length &&
        oldContent[oldContent.length - 1 - suffixLen] === newContent[newContent.length - 1 - suffixLen]
    ) {
        suffixLen++;
    }
    oldContent = oldContent.substring(0, oldContent.length - suffixLen);
    newContent = newContent.substring(0, newContent.length - suffixLen);
    
    // 3. Final whitespace trim
    oldContent = oldContent.trim();
    newContent = newContent.trim();
    
    // 4. If oldContent is now empty, it means it was a pure addition.
    // We can't use an empty string to find a location, so we fall back.
    if (oldContent === '' && newContent !== '') {
        return {
            oldContent: oldC,
            newContent: newC,
            minimized: false,
        };
    }
    
    // 5. Avoid sending newContent that contains oldContent after minimization
    // This can confuse the frontend logic.
    if (newContent.includes(oldContent) && oldContent !== newContent) {
        // This is a complex case. For now, we avoid minimization.
        // A more advanced strategy could be to expand the context slightly.
        return {
            oldContent: oldC,
            newContent: newC,
            minimized: false,
        };
    }

    return {
        oldContent,
        newContent,
        minimized: true,
    };
};

/**
 * Helper to get all occurrences of a substring in a string.
 * Returns an array of starting indices.
 */
const getAllOccurrences = (source, search) => {
    const indices = [];
    if (!search) return indices;
    let i = -1;
    while ((i = source.indexOf(search, i + 1)) !== -1) {
        indices.push(i);
    }
    return indices;
};

/**
 * Subagent 2: Diff Generation
 * Generates precise changes for a single file using an LLM.
 */
const generateDiffForFile = async (file, editRequest, context, apiKey) => {
    console.log(`[Diff Generation] Generating diff for file: ${file.name}`);

    // If file content is empty or very small, skip
    if (!file.content || file.content.length < 10) {
        console.log(`[Diff Generation] Skipping ${file.name} due to small or empty content.`);
        return [];
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
    
    const systemInstruction = {
        role: "system",
        parts: [{
            text: `You are an expert programmer and an AI assistant that specializes in editing code.
Your task is to analyze the user's edit request and the provided file content, and then generate a precise set of changes to fulfill the request.

You MUST follow these rules:
1.  Analyze the user's request: "${editRequest}".
2.  Analyze the full content of the file: \`${file.name}\`.
3.  Identify the exact parts of the file that need to be changed.
4.  For each change, provide the original content to be replaced (\`oldContent\`) and the new content to insert (\`newContent\`).
5.  The \`oldContent\` MUST be an exact substring from the original file.
6.  You MUST output your response as a valid JSON object. Do not include any text outside the JSON block.
7.  The JSON object should have a single key, "changes", which is an array of change objects.
8.  Each change object must have two keys: "oldContent" and "newContent".
9.  If NO changes are needed (e.g., the code is already correct or the request is irrelevant), return an empty array: \`{ "changes": [] }\`.
10. Ensure that the generated \`newContent\` includes proper indentation and formatting that matches the surrounding code.
11. Only provide changes for this file. Do not suggest creating new files or modifying other files.
12. Be precise. Do not replace more code than necessary. The \`oldContent\` should be as minimal as possible while still being unique enough to locate.

Example Response:
\`\`\`json
{
    "changes": [
        {
      "oldContent": "const oldVariable = 'value';",
      "newContent": "const newVariable = 'newValue';"
    },
    {
      "oldContent": "<p>Some old text</p>",
      "newContent": "<p>Some new, updated text</p>"
    }
  ]
}
\`\`\`
`
        }]
    };

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{
                    text: `Here is the file \`${file.name}\`:\n\n\`\`\`\n${file.content}\n\`\`\``
                }]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.0,
        },
        systemInstruction,
    };

    try {
    const response = await axios.post(apiUrl, requestBody, {
        headers: { 'Content-Type': 'application/json' }
    });

        if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
            console.warn(`[Diff Generation] No candidates returned for ${file.name}.`);
            return [];
        }
        
        const rawJson = response.data.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(rawJson);
        const rawChanges = parsedResponse.changes || [];
        
        if (rawChanges.length === 0) {
            console.log(`[Diff Generation] LLM reported no changes needed for ${file.name}.`);
            return [];
        }
        
        console.log(`[Diff Generation] Received ${rawChanges.length} raw changes from LLM for ${file.name}.`);

        const processedChanges = [];
        const fileContent = file.content;
        
        // This map will track how many times we've seen a given oldContent string
        const occurrenceTracker = new Map();
        
        for (const change of rawChanges) {
            const { oldContent: oldContentFull, newContent: newContentFull } = change;

            if (!oldContentFull || !fileContent.includes(oldContentFull)) {
                console.warn(`[Diff Generation] Skipping change because oldContent is not in file.`, { oldContent: oldContentFull });
                continue;
            }

            // Minimize the diff
            const { oldContent, newContent, minimized } = minimizeDiff(oldContentFull, newContentFull);
            
            // Determine the occurrence index
            const occurrences = getAllOccurrences(fileContent, oldContentFull);
            const currentCount = occurrenceTracker.get(oldContentFull) || 0;
            
            if (currentCount >= occurrences.length) {
                console.warn(`[Diff Generation] Skipping change due to ambiguous occurrence.`, { oldContentFull });
                continue; // We have more changes for this content than we can find in the file
            }
            const occurrenceIndex = currentCount;
            occurrenceTracker.set(oldContentFull, currentCount + 1);


            // Determine replacement type
            const length = oldContent.length;
            let replacementType = 'block';
            if (length <= 15) replacementType = 'word';
            else if (length <= 50) replacementType = 'phrase';
            else if (length <= 150) replacementType = 'sentence';

            processedChanges.push({
                id: generateId(),
                oldContentFull,
                newContentFull,
                oldContent,
                newContent,
                occurrenceIndex, // 0-based index of this specific occurrence
                replacementType,
                context: change.context, // Keep original context if provided
            });
        }
        
        console.log(`[Diff Generation] Processed ${processedChanges.length} changes for ${file.name}.`);
        return processedChanges;

    } catch (error) {
        console.error(`[Diff Generation] API call failed for ${file.name}:`, error.response ? error.response.data : error.message);
        // If the error is from parsing, log the raw response
        if (error instanceof SyntaxError && error.response) {
            console.error("Raw LLM Response:", error.response.data.candidates[0].content.parts[0].text);
        }
        return [];
    }
};

/**
 * This function is now deprecated as the frontend handles suggestions directly.
 * Kept for reference or future server-side application logic.
 */
const applyDiffsAsSuggestions = async (diffs, files) => {
    // This function's logic is being moved to the frontend.
    // The backend's responsibility is now to provide high-quality suggestions.
    console.log('[Deprecation] applyDiffsAsSuggestions is no longer applying changes.');
    return diffs; // Just pass them through
};

/**
 * Generates a human-readable summary of the edits.
 */
const generateEditSummary = (files, diffs) => {
    const fileCount = files.length;
    const diffCount = diffs.length;

    if (diffCount === 0) {
        return {
            phase: 'summary',
            message: "I analyzed the files but found no changes were needed. The code may already be correct.",
            filesAnalyzed: fileCount,
            suggestionsMade: 0,
        };
    }
    
    const fileNames = [...new Set(diffs.map(d => d.fileName))].join(', ');
    
    return {
        phase: 'summary',
        message: `I've prepared ${diffCount} change${diffCount > 1 ? 's' : ''} in ${fileCount} file${fileCount > 1 ? 's' : ''}: ${fileNames}. Please review the suggestions in the editor.`,
        filesAnalyzed: fileCount,
        suggestionsMade: diffCount,
    };
}; 