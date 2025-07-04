// functions/api/[[catchall]].js
import { query } from '../../api/dbConfig'; // Adjust path to dbConfig
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { json, error } from './utils'; // Import shared helpers
import { routeRequest } from './agents/masterAgent'; // Import the master agent
import { indexProjectFiles, indexSingleFile, removeFileFromIndex } from './services/indexingService'; // Add indexSingleFile and removeFileFromIndex imports

// Manually create error and json response helpers to avoid itty-router

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

// --- Main Pages Function Handler ---
export const onRequest = async (context) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const pathSegments = path.split('/').filter(Boolean);

  console.log(`--- Request received for: ${path} ---`);
  console.log('Environment keys:', Object.keys(env));

  if (pathSegments[0] !== 'api') {
    return new Response('Not Found.', { status: 404 });
  }

  const resource = pathSegments[1];
  const id = pathSegments[2];
  const subResource = pathSegments[3];

  // --- Authentication ---
  let user; // To store authenticated user info
  if (!(resource === 'auth' && (id === 'login' || id === 'register'))) {
    const authResult = authenticate(request, env);
    if (authResult.error) return authResult.error;
    user = authResult.user; // Set the user for protected routes
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
      const userId = user.userId;
      
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
          
          const newFile = { ...result.rows[0], id: result.rows[0].file_id };
          
          // Automatically index the file if it's a file type and has content
          if (type === 'file' && content && content.trim() !== '') {
            try {
              await indexSingleFile(newFile.file_id, env);
              console.log(`Auto-indexed new file: ${newFile.name}`);
            } catch (indexError) {
              console.error(`Failed to auto-index new file ${newFile.name}:`, indexError);
              // Don't fail the file creation if indexing fails
            }
          }
          
          return json(newFile, { status: 201 });
        }
      }

      if (id && subResource === 'index' && request.method === 'POST') {
        // POST /api/projects/:projectId/index
        const ownerResult = await query('SELECT user_id FROM projects WHERE project_id = $1', [id], env);
        if (ownerResult.rows.length === 0) return error(404, { message: 'Project not found.' });
        if (ownerResult.rows[0].user_id !== userId) return error(403, { message: 'Forbidden.' });

        const result = await indexProjectFiles(id, env);
        if (result.success) {
          return json({ message: result.message });
        } else {
          return error(500, { message: result.message });
        }
      }
    }

    if (resource === 'files' && id) {
      // Routes for /api/files/:fileId
      const ownerCheck = await query('SELECT p.user_id FROM files f JOIN projects p ON f.project_id = p.project_id WHERE f.file_id = $1', [id], env);
      if (ownerCheck.rows.length === 0) return error(404, { message: 'File not found.' });
      if (ownerCheck.rows[0].user_id !== user.userId) return error(403, { message: 'Forbidden.' });
      
      if (request.method === 'GET') {
        const result = await query('SELECT file_id, project_id, parent_id, name, type, content, created_at, updated_at FROM files WHERE file_id = $1', [id], env);
        if (result.rows.length === 0) return error(404, { message: 'File not found.' });
        return json({ ...result.rows[0], id: result.rows[0].file_id });
      }
      if (request.method === 'PUT') {
         const { content, name } = await request.json();
         if (typeof content !== 'string') return error(400, { message: 'Content must be a string.' });
         
         // Get the file info before updating
         const fileInfoResult = await query('SELECT file_id, name, type FROM files WHERE file_id = $1', [id], env);
         const fileInfo = fileInfoResult.rows[0];
         
         // Update the name if provided, otherwise just update content
         if(name) {
            await query('UPDATE files SET content = $1, name = $2 WHERE file_id = $3', [content, name, id], env);
         } else {
            await query('UPDATE files SET content = $1 WHERE file_id = $2', [content, id], env);
         }

         // Automatically re-index the file if it's a file type and has content
         if (fileInfo && fileInfo.type === 'file' && content && content.trim() !== '') {
           try {
             await indexSingleFile(id, env);
             console.log(`Auto-reindexed updated file: ${fileInfo.name}`);
           } catch (indexError) {
             console.error(`Failed to auto-reindex updated file ${fileInfo.name}:`, indexError);
             // Don't fail the file update if indexing fails
           }
         }

         return json({ message: `File ${id} updated.` });
      }
      if (request.method === 'DELETE') {
        // Check if it's a folder to handle recursive delete
        const fileCheck = await query('SELECT type FROM files WHERE file_id = $1', [id], env);
        if (fileCheck.rows.length === 0) return error(404, { message: 'File not found.' });

        // Get all file IDs that will be deleted (including recursive folder contents)
        const getFilesToDeleteQuery = `
          WITH RECURSIVE sub_files AS (
            SELECT file_id, type FROM files WHERE file_id = $1
            UNION ALL
            SELECT f.file_id, f.type FROM files f
            INNER JOIN sub_files sf ON f.parent_id = sf.file_id
          )
          SELECT file_id FROM sub_files WHERE type = 'file';
        `;
        
        const filesToDeleteResult = await query(getFilesToDeleteQuery, [id], env);
        const fileIdsToDelete = filesToDeleteResult.rows.map(row => row.file_id);
        
        // Remove files from vector store before deleting from database
        for (const fileId of fileIdsToDelete) {
          try {
            await removeFileFromIndex(fileId, env);
            console.log(`Removed file ${fileId} from vector store`);
          } catch (indexError) {
            console.error(`Failed to remove file ${fileId} from vector store:`, indexError);
            // Continue with deletion even if vector store removal fails
          }
        }

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
        return json({ message: `File or folder ${id} and all its contents deleted successfully` });
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
      const authResult = authenticate(request, env);
      if (authResult.error) return authResult.error;
      const user = authResult.user;
      const body = await request.json();
      return await handleAiAction(body, env, user);
    }

    // Fallback for any unhandled routes
    return new Response('API route not found.', { status: 404 });

  } catch (e) {
    console.error('Error in API handler:', e.stack);
    return error(500, { message: 'An internal server error occurred.', details: e.message });
  }
};

const handleAiAction = async (body, env, user) => {
  try {
    // Pass the full context (request body + env + user) to the master agent
    return routeRequest(body, env, user);
  } catch (err) {
    console.error(`[AI ERROR] for user ${user?.userId}:`, err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || 'AI request failed.';
    return error(err.response?.status || 500, { message: `AI service error: ${errorMessage}` });
  }
}; 