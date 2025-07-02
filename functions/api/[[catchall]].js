// functions/api/[[catchall]].js
import { query } from '../../api/dbConfig'; // Adjust path to dbConfig
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios'; // Import axios

// Manually create error and json response helpers to avoid itty-router
const json = (data, options) => {
  return new Response(JSON.stringify(data), {
    status: options?.status || 200,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
};

const error = (status, data) => {
  return json(data, { status });
};

// --- Authentication Middleware (as a helper function) ---
const authenticate = (request, env) => {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return { error: error(401, { message: 'No token provided.' }) };
  }

  const secret = env.JWT_SECRET;
  if (!secret) {
    return { error: error(500, { message: 'Internal server configuration error.' }) };
  }

  try {
    const user = jwt.verify(token, secret);
    return { user }; // Success
  } catch (err) {
    return { error: error(403, { message: 'Invalid or expired token.' }) };
  }
};

const buildFileTree = (files) => {
    const fileMap = {};
    const tree = [];

    // First pass: map each file by its ID
    files.forEach(file => {
        fileMap[file.file_id] = { ...file, children: [] };
    });

    // Second pass: build the tree structure
    files.forEach(file => {
        if (file.parent_id) {
            // This is a nested file/folder
            const parent = fileMap[file.parent_id];
            if (parent) {
                parent.children.push(fileMap[file.file_id]);
            } else {
                // Orphan file, might happen with inconsistent data
                // Add it to the root for visibility
                tree.push(fileMap[file.file_id]);
            }
        } else {
            // This is a root file/folder
            tree.push(fileMap[file.file_id]);
        }
    });

    return tree;
};

const handleProjects = async (context) => {
    const { request, env } = context;
    const { user } = authenticate(request, env);

    switch (request.method) {
        case 'GET':
            // ... implementation for GET /api/projects
            break;
        case 'POST':
            // ... implementation for POST /api/projects
            break;
        // ... other methods
    }
};

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const pathSegments = path.split('/').filter(Boolean);

  console.log(`--- Request received for: ${path} ---`);

  // --- Simple Router ---
  if (pathSegments[0] === 'api') {
    const resource = pathSegments[1];
    const id = pathSegments[2];
    const subResource = pathSegments[3];

    // --- Authentication ---
    // Public routes
    if (resource === 'auth' && (id === 'login' || id === 'register')) {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        // Logic is handled below in the try...catch block
    } else {
        // Protected routes
        const authResult = authenticate(request, env);
        if (authResult.error) return authResult.error;
        // Attach user to context for protected handlers to use
        context.user = authResult.user;
    }

    try {
        if (resource === 'auth') {
             if (id === 'register') {
                // --- [Register] Handler ---
                const { username, email, password } = await request.json();
                if (!username || !email || !password) return error(400, { message: 'Username, email, and password are required.' });
                
                const checkUserQuery = 'SELECT user_id FROM users WHERE email = $1';
                const existingUserResult = await query(checkUserQuery, [email], env);
                if (existingUserResult.rows.length > 0) return error(409, { message: 'Email already registered.' });

                const hashedPassword = await bcrypt.hash(password, 10);
                const insertUserQuery = `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, email, created_at;`;
                const newUserResult = await query(insertUserQuery, [username, email, hashedPassword], env);
                
                return json({ message: 'User registered successfully!', user: newUserResult.rows[0] }, { status: 201 });
            }
            if (id === 'login') {
                // --- [Login] Handler ---
                const { email, password } = await request.json();
                if (!email || !password) return error(400, { message: 'Email and password are required.' });

                const findUserQuery = 'SELECT user_id, email, username, password_hash FROM users WHERE email = $1';
                const userResult = await query(findUserQuery, [email], env);
                if (userResult.rows.length === 0) return error(401, { message: 'Invalid credentials.' });

                const user = userResult.rows[0];
                const isMatch = await bcrypt.compare(password, user.password_hash);
                if (!isMatch) return error(401, { message: 'Invalid credentials.' });

                const secret = env.JWT_SECRET;
                if (!secret) return error(500, { message: 'Internal server configuration error.' });
                
                const payload = { userId: user.user_id, username: user.username };
                const token = jwt.sign(payload, secret, { expiresIn: env.JWT_EXPIRES_IN || '1h' });
                
                return json({ message: 'Login successful!', accessToken: token, user: { userId: user.user_id, username: user.username, email: user.email }});
            }
        }

        if (resource === 'projects') {
            const userId = context.user.userId;
            
            if (request.method === 'GET' && !id) {
                // GET /api/projects
                const result = await query('SELECT project_id, name, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [userId], env);
                const projects = result.rows.map(p => ({ ...p, id: p.project_id }));
                return json(projects);
            }

            if (request.method === 'POST' && !id) {
                // POST /api/projects
                const { name } = await request.json();
                if (!name) return error(400, { message: 'Project name is required.' });

                const result = await query('INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING project_id, user_id, name, created_at, updated_at;', [userId, name], env);
                return json(result.rows[0], { status: 201 });
            }
            
            if (request.method === 'DELETE' && id && !subResource) {
                // DELETE /api/projects/:projectId
                const ownerResult = await query('SELECT user_id FROM projects WHERE project_id = $1', [id], env);
                if (ownerResult.rows.length === 0) return error(404, { message: 'Project not found.' });
                if (ownerResult.rows[0].user_id !== userId) return error(403, { message: 'Forbidden: You do not own this project.' });

                await query('DELETE FROM projects WHERE project_id = $1', [id], env);
                return json({ message: `Project ${id} deleted successfully` });
            }

            if (id && subResource === 'files') {
                // Routes for /api/projects/:projectId/files
                const ownerResult = await query('SELECT user_id FROM projects WHERE project_id = $1', [id], env);
                if (ownerResult.rows.length === 0) return error(404, { message: 'Project not found.' });
                if (ownerResult.rows[0].user_id !== userId) return error(403, { message: 'Forbidden.' });

                if (request.method === 'GET') {
                    // Fetch all files and folders for the project
                    const result = await query('SELECT file_id, parent_id, name, type, content, created_at, updated_at FROM files WHERE project_id = $1 ORDER BY name ASC', [id], env);
                    
                    // Build the hierarchical tree structure
                    const fileTree = buildFileTree(result.rows);

                    return json(fileTree);
                }
                if (request.method === 'POST') {
                    const { name, type, parent_id = null, content = null } = await request.json(); // parent_id is null for root files/folders
                    if (!name || !type) return error(400, { message: 'File name and type are required.' });
                    if (type !== 'file' && type !== 'folder') return error(400, { message: 'Type must be "file" or "folder".' });

                    const result = await query(
                        'INSERT INTO files (project_id, parent_id, name, type, content) VALUES ($1, $2, $3, $4, $5) RETURNING file_id, project_id, parent_id, name, type, created_at, updated_at;', 
                        [id, parent_id, name, type, type === 'file' ? (content || '') : null], 
                        env
                    );
                    return json({ ...result.rows[0], id: result.rows[0].file_id }, { status: 201 });
                }
            }
        }

        if (resource === 'files' && id) {
            // Routes for /api/files/:fileId
            const ownerCheck = await query('SELECT p.user_id FROM files f JOIN projects p ON f.project_id = p.project_id WHERE f.file_id = $1', [id], env);
            if (ownerCheck.rows.length === 0) return error(404, { message: 'File not found.' });
            if (ownerCheck.rows[0].user_id !== context.user.userId) return error(403, { message: 'Forbidden.' });
            
            if (request.method === 'GET') {
                const result = await query('SELECT file_id, project_id, parent_id, name, type, content, created_at, updated_at FROM files WHERE file_id = $1', [id], env);
                if (result.rows.length === 0) return error(404, { message: 'File not found.' });
                return json({ ...result.rows[0], id: result.rows[0].file_id });
            }
            if (request.method === 'PUT') {
                 const { content, name } = await request.json();
                 if (typeof content !== 'string') return error(400, { message: 'Content must be a string.' });
                 
                 // Update the name if provided, otherwise just update content
                 if(name) {
                    await query('UPDATE files SET content = $1, name = $2 WHERE file_id = $3', [content, name, id], env);
                 } else {
                    await query('UPDATE files SET content = $1 WHERE file_id = $2', [content, id], env);
                 }

                 return json({ message: `File ${id} updated.` });
            }
            if (request.method === 'DELETE') {
                // Check if it's a folder to handle recursive delete
                const fileCheck = await query('SELECT type FROM files WHERE file_id = $1', [id], env);
                if (fileCheck.rows.length === 0) return error(404, { message: 'File not found.' });

                // Use a recursive query to delete a folder and all its contents
                const deleteQuery = `
                    WITH RECURSIVE sub_files AS (
                        SELECT file_id FROM files WHERE file_id = $1
                        UNION ALL
                        SELECT f.file_id FROM files f
                        INNER JOIN sub_files sf ON f.parent_id = sf.file_id
                    )
                    DELETE FROM files WHERE file_id IN (SELECT file_id FROM sub_files);
                `;
                
                await query(deleteQuery, [id], env);
                return json({ message: `File or folder ${id} and its contents deleted.` });
            }

            if (request.method === 'PATCH') {
                 const { name, parent_id } = await request.json();
                 const updates = [];
                 const values = [];
                 let i = 1;

                 if (name !== undefined) {
                     updates.push(`name = $${i++}`);
                     values.push(name);
                 }

                 if (parent_id !== undefined) {
                      if (parent_id) { // validation
                         const parentCheck = await query('SELECT type FROM files WHERE file_id = $1', [parent_id], env);
                         if (parentCheck.rows.length === 0 || parentCheck.rows[0].type !== 'folder') {
                             return error(400, { message: 'Invalid parent folder.' });
                         }
                     }
                     updates.push(`parent_id = $${i++}`);
                     values.push(parent_id);
                 }

                 if (updates.length > 0) {
                     values.push(id);
                     const queryText = `UPDATE files SET ${updates.join(', ')}, updated_at = NOW() WHERE file_id = $${i}`;
                     await query(queryText, values, env);
                     return json({ message: `File ${id} updated.` });
                 }

                 return json({ message: 'No update performed.' });
            }
        }
        
        if (resource === 'ai' && id === 'gemini-action') {
            if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
            return handleAiAction(context);
        }

        return error(404, { message: 'Route not found.' });

    } catch(err) {
        console.error('--- [CRITICAL ERROR] ---');
        console.error('Error on path:', path, err);
        return error(500, { message: 'An unexpected server error occurred.' });
    }
  }

  return new Response('Not Found.', { status: 404 });
};

// --- AI Action Handler (Refactored) ---
const handleAiAction = async (context) => {
    const { request, env, user } = context;
    const userId = user.userId;

    try {
        const { action, text, context: requestContext, history, customPrompt } = await request.json();

        if (!action || !text) {
            return error(400, { message: 'Action and text are required.' });
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set in the environment variables.');
            return error(500, { message: 'AI service configuration error.' });
        }
        
        let prompt = '';
        switch (action.toLowerCase()) {
            case 'summarize':
              prompt = `Summarize the following text:\n---\n${text}\n---\nSummary:`;
              break;
            case 'rewrite':
              prompt = `Rewrite the following text in a clear and concise way:\n---\n${text}\n---\nRewritten Text:`;
              break;
            case 'make shorter':
              prompt = `Make the following text shorter while preserving the main points:\n---\n${text}\n---\nShorter Text:`;
              break;
            case 'make longer':
              prompt = `Expand on the following text, adding relevant details or explanation:\n---\n${text}\n---\nExpanded Text:`;
              break;
            case 'chat':
                let historyText = '';
                if (history && history.length > 0) {
                    historyText = 'Here is the conversation history:\n---\n' + history.map(msg => `${msg.author}: ${msg.text}`).join('\n') + '\n---\n\n';
                }

                if (requestContext?.fileContent) {
                    prompt = `Given the following file content from "${requestContext.fileName}":\n\n---\n${requestContext.fileContent}\n---\n\n${historyText}Now, answer the user's question:\nUser: ${text}\n---\nAI:`;
                } else {
                    prompt = `${historyText}The user is asking a question in a chat. Provide a helpful response.\n---\nUser: ${text}\n---\nAI:`;
                }
                break;
            case 'custom':
                if (!customPrompt) {
                    return error(400, { message: 'A custom prompt is required for this action.' });
                }
                prompt = `Instruction: "${customPrompt}"\n\nProcess the following text based on the instruction:\n---\n${text}\n---\nResult:`;
                break;
            default:
                 return error(400, { message: `Unsupported AI action: ${action}` });
        }

        const model = 'gemini-pro';

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        const geminiResponse = await axios.post(apiUrl, requestBody, { headers: { 'Content-Type': 'application/json' } });

        let generatedText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        return json({ result: generatedText.trim() });

    } catch (err) {
        console.error(`[AI ERROR] for user ${userId}:`, err.response?.data || err.message);
        const errorMessage = err.response?.data?.error?.message || 'AI request failed.';
        return error(err.response?.status || 500, { message: `AI service error: ${errorMessage}` });
    }
}; 