import { query } from '../../../api/dbConfig';

export const indexProjectFiles = async (projectId, env) => {
    console.log(`Starting indexing for project ID: ${projectId}`);

    // 1. Fetch all files for the project from D1
    const filesResult = await query('SELECT file_id, name, content FROM files WHERE project_id = $1 AND type = \'file\'', [projectId], env);
    const files = filesResult.rows;

    if (!files || files.length === 0) {
        console.log(`No files found for project ${projectId}. Nothing to index.`);
        return { success: true, message: 'No files to index.' };
    }

    // 2. Generate embeddings for each file using Workers AI binding directly
    const model = '@cf/baai/bge-base-en-v1.5';
    
    const embeddings = [];
    for (const file of files) {
        if (file.content && file.content.trim() !== '') {
            try {
                const response = await env.AI.run(model, { text: [file.content] });
                const vector = response.data[0];
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
                console.error(`Failed to generate embedding for file ${file.file_id} (${file.name}):`, err);
            }
        }
    }

    if (embeddings.length === 0) {
        console.log('No valid content found to generate embeddings.');
        return { success: true, message: 'No content to index.' };
    }

    // 3. Insert embeddings into the Vectorize index
    const index = env.VECTORIZE_INDEX;
    try {
        await index.upsert(embeddings);
        console.log(`Successfully indexed ${embeddings.length} files for project ${projectId}.`);
        return { success: true, message: `Indexed ${embeddings.length} files.` };
    } catch (err) {
        console.error(`Failed to insert embeddings into Vectorize for project ${projectId}:`, err);
        return { success: false, message: 'Failed to index files.' };
    }
};
