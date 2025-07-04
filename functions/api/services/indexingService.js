import { query } from '../../../api/dbConfig';
import axios from 'axios';
import { getVectorStore } from './cloudflareKVVectorStore';

// Function to index a single file
export const indexSingleFile = async (fileId, env) => {
    console.log(`Starting indexing for file ID: ${fileId}`);

    // 1. Fetch the specific file from D1
    const fileResult = await query('SELECT file_id, name, content, project_id FROM files WHERE file_id = $1 AND type = \'file\'', [fileId], env);
    
    if (!fileResult.rows || fileResult.rows.length === 0) {
        console.log(`File ${fileId} not found or is not a file. Nothing to index.`);
        return { success: true, message: 'File not found or not indexable.' };
    }

    const file = fileResult.rows[0];
    
    if (!file.content || file.content.trim() === '') {
        console.log(`File ${fileId} has no content. Nothing to index.`);
        return { success: true, message: 'File has no content to index.' };
    }

    // 2. Generate embedding for the file using Gemini
    const apiKey = env.GEMINI_API_KEY;
    const embeddingModel = 'text-embedding-004';
    const embeddingApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`;

    try {
        const embeddingRequestBody = {
            model: `models/${embeddingModel}`,
            content: {
                parts: [{ text: file.content }]
            },
            taskType: 'RETRIEVAL_DOCUMENT'
        };
        const embeddingResponse = await axios.post(embeddingApiUrl, embeddingRequestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        const vector = embeddingResponse.data.embedding.values;

        const embedding = {
            id: `file-${file.file_id}`,
            values: vector,
            metadata: {
                projectId: file.project_id,
                fileId: file.file_id,
                fileName: file.name
            }
        };

        // 3. Insert embedding into the vector store
        const index = getVectorStore(env);
        await index.upsert([embedding], env);
        
        console.log(`Successfully indexed file ${fileId} (${file.name}).`);
        return { success: true, message: `Indexed file ${file.name}.` };
        
    } catch (err) {
        console.error(`Failed to generate embedding for file ${fileId} (${file.name}):`, err.response?.data || err.message);
        return { success: false, message: 'Failed to index file.' };
    }
};

export const indexProjectFiles = async (projectId, env) => {
    console.log(`Starting indexing for project ID: ${projectId}`);

    // 1. Fetch all files for the project from D1
    const filesResult = await query('SELECT file_id, name, content FROM files WHERE project_id = $1 AND type = \'file\'', [projectId], env);
    const files = filesResult.rows;

    if (!files || files.length === 0) {
        console.log(`No files found for project ${projectId}. Nothing to index.`);
        return { success: true, message: 'No files to index.' };
    }

    // 2. Generate embeddings for each file using Gemini
    const apiKey = env.GEMINI_API_KEY;
    const embeddingModel = 'text-embedding-004';
    const embeddingApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`;
    
    const embeddings = [];
    for (const file of files) {
        if (file.content && file.content.trim() !== '') {
            try {
                const embeddingRequestBody = {
                    model: `models/${embeddingModel}`,
                    content: {
                        parts: [{ text: file.content }]
                    },
                    taskType: 'RETRIEVAL_DOCUMENT'
                };
                const embeddingResponse = await axios.post(embeddingApiUrl, embeddingRequestBody, {
                    headers: { 'Content-Type': 'application/json' }
                });
                const vector = embeddingResponse.data.embedding.values;

                embeddings.push({
                    id: `file-${file.file_id}`, // Vectorize requires string IDs
                    values: vector,
                    metadata: {
                        projectId: projectId,
                        fileId: file.file_id,
                        fileName: file.name
                    }
                });
            } catch (err) {
                console.error(`Failed to generate embedding for file ${file.file_id} (${file.name}):`, err.response?.data || err.message);
            }
        }
    }

    if (embeddings.length === 0) {
        console.log('No valid content found to generate embeddings.');
        return { success: true, message: 'No content to index.' };
    }

    // 3. Insert embeddings into the vector store
    const index = getVectorStore(env);
    try {
        await index.upsert(embeddings, env);
        console.log(`Successfully indexed ${embeddings.length} files for project ${projectId}.`);
        return { success: true, message: `Indexed ${embeddings.length} files.` };
    } catch (err) {
        console.error(`Failed to insert embeddings into vector store for project ${projectId}:`, err);
        return { success: false, message: 'Failed to index files.' };
    }
};

// Function to remove a file from the vector store
export const removeFileFromIndex = async (fileId, env) => {
    console.log(`Removing file ID: ${fileId} from vector store`);
    
    try {
        const index = getVectorStore(env);
        
        // Delete the file from the vector store
        await index.delete([`file-${fileId}`], env);
        
        console.log(`Successfully removed file ${fileId} from vector store.`);
        return { success: true, message: `Removed file from index.` };
        
    } catch (err) {
        console.error(`Failed to remove file ${fileId} from vector store:`, err.message);
        return { success: false, message: 'Failed to remove file from index.' };
    }
};
