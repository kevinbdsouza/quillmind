// quillmind/backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./dbConfig'); // Make sure dbConfig is imported
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Import axios

const app = express();
const PORT = process.env.PORT || 5001;

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if there isn't any token

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not defined in .env file!');
    return res.status(500).json({ message: 'Internal server configuration error.' });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.sendStatus(403); // Token is no longer valid
    req.user = user; // Add user payload to request object
    next(); // Proceed to the next middleware or route handler
  });
};

// --- Routes ---

// Simple test route (keep as is)
app.get('/', (req, res) => {
  res.send('QuillMind Backend is running!');
});

// --- Updated User Registration Endpoint ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // --- Basic Validation ---
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    // --- Check if user exists ---
    const checkUserQuery = 'SELECT user_id FROM users WHERE email = $1';
    const existingUserResult = await db.query(checkUserQuery, [email]);

    if (existingUserResult.rows.length > 0) {
      // 409 Conflict - User already exists
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // --- Hash Password ---
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // --- Insert new user into database ---
    const insertUserQuery = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email, created_at;
    `;
    // Use parameterized query to prevent SQL injection
    const newUserResult = await db.query(insertUserQuery, [username, email, hashedPassword]);

    // Get the newly created user data from the RETURNING clause
    const newUser = newUserResult.rows[0];
    console.log('User registered successfully in DB:', newUser);

    // --- Respond with success ---
    // Send back the newly created user's info (excluding password hash)
    res.status(201).json({ // 201 Created
      message: 'User registered successfully!',
      user: newUser // Contains user_id, username, email, created_at
    });

  } catch (error) {
    // Log the detailed error on the server
    console.error('Registration Error:', error);

    // Check for specific database errors if needed (e.g., unique constraint violation on username)
    if (error.code === '23505') { // PostgreSQL unique violation error code
        if (error.constraint === 'users_username_key') {
             return res.status(409).json({ message: 'Username already taken.' });
        }
         if (error.constraint === 'users_email_key') {
             // This case should ideally be caught by the initial check, but acts as a safeguard
             return res.status(409).json({ message: 'Email already registered.' });
        }
    }

    // Generic server error response
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});
// ---------------------------------------------


app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- Basic Validation ---
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // --- Find user by email ---
    const findUserQuery = 'SELECT user_id, email, username, password_hash FROM users WHERE email = $1';
    const userResult = await db.query(findUserQuery, [email]);

    if (userResult.rows.length === 0) {
      // User not found - Use a generic message for security (don't reveal if email exists)
      return res.status(401).json({ message: 'Invalid credentials.' }); // 401 Unauthorized
    }

    const user = userResult.rows[0];

    // --- Compare provided password with stored hash ---
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      // Passwords don't match - Use the same generic message
      return res.status(401).json({ message: 'Invalid credentials.' }); // 401 Unauthorized
    }

    // --- Passwords match: Generate JWT ---
    const payload = {
      userId: user.user_id, // Include user ID in the token payload
      username: user.username,
      // DO NOT include password hash or other sensitive info!
    };

    const secret = process.env.JWT_SECRET;
    const options = {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h', // Use expiry from .env or default
    };

    // Check if secret is defined
    if (!secret) {
        console.error('JWT_SECRET is not defined in .env file!');
        return res.status(500).json({ message: 'Internal server configuration error.' });
    }

    const token = jwt.sign(payload, secret, options);

    // --- Respond with token and basic user info ---
    res.status(200).json({ // 200 OK
      message: 'Login successful!',
      accessToken: token,
      user: { // Send back non-sensitive info useful for the frontend
        userId: user.user_id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});
// ------------------------

// --- Project Routes (Protected) ---

// Create Project
app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    // Note: req.user comes from authenticateToken middleware
    const userId = req.user.userId; // This should be the UUID from the token payload

    if (!name) {
      return res.status(400).json({ message: 'Project name is required.' });
    }

    const insertQuery = `
      INSERT INTO projects (user_id, name)
      VALUES ($1, $2)
      RETURNING project_id, user_id, name, created_at, updated_at;
    `;
    const result = await db.query(insertQuery, [userId, name]);
    const newProject = result.rows[0];

    console.log(`User ${userId} created project ${newProject.project_id}: ${name}`);
    res.status(201).json(newProject); // Return the newly created project details

  } catch (error) {
    console.error('Create Project Error:', error);
    res.status(500).json({ message: 'Internal server error during project creation.' });
  }
});

// Get User's Projects
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`Fetching projects for user ${userId}`);

    const selectQuery = `
      SELECT project_id, user_id, name, created_at, updated_at
      FROM projects
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await db.query(selectQuery, [userId]);

    // Map database fields (e.g., project_id) to frontend expected fields (e.g., id)
    const projects = result.rows.map(p => ({ ...p, id: p.project_id }));

    res.status(200).json(projects);

  } catch (error) {
    console.error('Get Projects Error:', error);
    res.status(500).json({ message: 'Internal server error while fetching projects.' });
  }
});

// Delete Project (and its files via CASCADE constraint)
app.delete('/api/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;

    // First, verify ownership
    const checkOwnerQuery = 'SELECT user_id FROM projects WHERE project_id = $1';
    const ownerResult = await db.query(checkOwnerQuery, [projectId]);

    if (ownerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found.' });
    }
    if (ownerResult.rows[0].user_id !== userId) {
        // Important: Check UUID equality correctly
        return res.status(403).json({ message: 'Forbidden: You do not own this project.' });
    }

    // Ownership verified, proceed with deletion
    // The ON DELETE CASCADE constraint on the 'files' table handles file deletion
    const deleteQuery = 'DELETE FROM projects WHERE project_id = $1 RETURNING project_id;';
    const result = await db.query(deleteQuery, [projectId]);

    if (result.rowCount === 0) {
        // Should have been caught by the 404 above, but as a safeguard
        return res.status(404).json({ message: 'Project not found during deletion attempt.' });
    }

    console.log(`User ${userId} deleted project ${projectId}`);
    res.status(200).json({ message: `Project ${projectId} deleted successfully` });

  } catch (error) {
    console.error('Delete Project Error:', error);
    res.status(500).json({ message: 'Internal server error during project deletion.' });
  }
});

// --- File Routes (Protected) ---

// Create File in Project
app.post('/api/projects/:projectId/files', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, file_type = 'markdown', path = '/' } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ message: 'File name is required.' });
    }

    // 1. Verify user owns the project they're adding a file to
    const checkOwnerQuery = 'SELECT user_id FROM projects WHERE project_id = $1';
    const ownerResult = await db.query(checkOwnerQuery, [projectId]);

    if (ownerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found.' });
    }
    if (ownerResult.rows[0].user_id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this project.' });
    }

    // 2. Insert the new file
    const insertFileQuery = `
      INSERT INTO files (project_id, name, path, file_type, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING file_id, project_id, name, path, file_type, created_at, updated_at;
    `;
    // Insert with empty content initially
    const newFileResult = await db.query(insertFileQuery, [projectId, name, path, file_type, '']);
    const newFile = newFileResult.rows[0];

    console.log(`User ${userId} created file "${name}" (ID: ${newFile.file_id}) in project ${projectId}`);
    // Map file_id to id for frontend consistency
    res.status(201).json({ ...newFile, id: newFile.file_id });

  } catch (error) {
    console.error('Create File Error:', error);
    res.status(500).json({ message: 'Internal server error during file creation.' });
  }
});

// Get Files in Project (Metadata only)
app.get('/api/projects/:projectId/files', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;

    // 1. Verify user owns the project
    const checkOwnerQuery = 'SELECT user_id FROM projects WHERE project_id = $1';
    const ownerResult = await db.query(checkOwnerQuery, [projectId]);

    if (ownerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found.' });
    }
    if (ownerResult.rows[0].user_id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this project.' });
    }

    // 2. Fetch file metadata (excluding content)
    const selectFilesQuery = `
      SELECT file_id, project_id, name, path, file_type, created_at, updated_at
      FROM files
      WHERE project_id = $1
      ORDER BY name ASC;
    `;
    const filesResult = await db.query(selectFilesQuery, [projectId]);

    console.log(`User ${userId} fetching files for project ${projectId}`);
    // Map file_id to id
    const files = filesResult.rows.map(f => ({ ...f, id: f.file_id }));
    res.status(200).json(files);

  } catch (error) {
    console.error('Get Files Error:', error);
    res.status(500).json({ message: 'Internal server error while fetching files.' });
  }
});

// Get Specific File Content & Metadata
app.get('/api/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // 1. Verify user owns the project containing the file
    // We need a JOIN to check the user_id on the parent project
    const checkOwnerQuery = `
        SELECT f.file_id, f.project_id, p.user_id
        FROM files f
        JOIN projects p ON f.project_id = p.project_id
        WHERE f.file_id = $1;
    `;
    const ownerResult = await db.query(checkOwnerQuery, [fileId]);

    if (ownerResult.rows.length === 0) {
        return res.status(404).json({ message: 'File not found.' });
    }
    if (ownerResult.rows[0].user_id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this file.' });
    }

    // 2. Fetch file data including content
    const selectFileQuery = `
      SELECT file_id, project_id, name, path, file_type, content, created_at, updated_at
      FROM files
      WHERE file_id = $1;
    `;
    const fileResult = await db.query(selectFileQuery, [fileId]);

    // Result should be guaranteed by owner check, but double-check
    if (fileResult.rows.length === 0) {
        return res.status(404).json({ message: 'File not found after ownership check.' });
    }

    console.log(`User ${userId} fetching file ${fileId}`);
    // Map file_id to id
    const fileData = { ...fileResult.rows[0], id: fileResult.rows[0].file_id };
    res.status(200).json(fileData);

  } catch (error) {
    console.error('Get File Content Error:', error);
    res.status(500).json({ message: 'Internal server error while fetching file content.' });
  }
});

// Update File Content / Metadata
app.put('/api/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    // Only allow updating content for now, as per frontend apiService call
    const { content } = req.body;
    const userId = req.user.userId;

    // Validate content (at least check if it exists)
    if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content must be provided as a string.' });
    }

    // 1. Verify user owns the project containing the file (similar JOIN as GET)
    const checkOwnerQuery = `
        SELECT p.user_id
        FROM files f
        JOIN projects p ON f.project_id = p.project_id
        WHERE f.file_id = $1;
    `;
    const ownerResult = await db.query(checkOwnerQuery, [fileId]);

    if (ownerResult.rows.length === 0) {
        return res.status(404).json({ message: 'File not found.' });
    }
    if (ownerResult.rows[0].user_id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this file.' });
    }

    // 2. Update file content (and updated_at via trigger or explicitly)
    // The trigger function setup earlier should handle updated_at automatically
    const updateFileQuery = `
      UPDATE files
      SET content = $1
      -- updated_at = NOW() -- Add this if trigger wasn't setup
      WHERE file_id = $2
      RETURNING file_id;
    `;
    const updateResult = await db.query(updateFileQuery, [content, fileId]);

    if (updateResult.rowCount === 0) {
      // Should be caught by owner check, but safeguard
      return res.status(404).json({ message: 'File not found during update attempt.' });
    }

    console.log(`User ${userId} updated file ${fileId}`);
    res.status(200).json({ message: `File ${fileId} updated successfully` });

  } catch (error) {
    console.error('Update File Error:', error);
    res.status(500).json({ message: 'Internal server error during file update.' });
  }
});

// Delete File
app.delete('/api/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // 1. Verify user owns the project containing the file
    const checkOwnerQuery = `
        SELECT p.user_id
        FROM files f
        JOIN projects p ON f.project_id = p.project_id
        WHERE f.file_id = $1;
    `;
    const ownerResult = await db.query(checkOwnerQuery, [fileId]);

    if (ownerResult.rows.length === 0) {
        return res.status(404).json({ message: 'File not found.' });
    }
    if (ownerResult.rows[0].user_id !== userId) {
        return res.status(403).json({ message: 'Forbidden: You do not own this file.' });
    }

    // 2. Delete the file
    const deleteFileQuery = 'DELETE FROM files WHERE file_id = $1 RETURNING file_id;';
    const deleteResult = await db.query(deleteFileQuery, [fileId]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'File not found during delete attempt.' });
    }

    console.log(`User ${userId} deleted file ${fileId}`);
    res.status(200).json({ message: `File ${fileId} deleted successfully` });

  } catch (error) {
    console.error('Delete File Error:', error);
    res.status(500).json({ message: 'Internal server error during file deletion.' });
  }
});

// --- AI Routes (Protected) ---

// Simple Gemini Action Endpoint
app.post('/api/ai/gemini-action', authenticateToken, async (req, res) => {
  const { action, text } = req.body;
  const userId = req.user.userId; // For logging/context if needed later

  if (!action || !text) {
    return res.status(400).json({ message: 'Action and text are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in the environment variables.');
    return res.status(500).json({ message: 'AI service configuration error.' });
  }

  // --- Basic Prompt Engineering --- 
  let prompt = '';
  switch (action.toLowerCase()) {
    case 'summarize':
      prompt = `Summarize the following text:
\n---\n${text}\n---\nSummary:`;
      break;
    case 'rewrite':
      prompt = `Rewrite the following text in a clear and concise way:
\n---\n${text}\n---\nRewritten Text:`;
      break;
    case 'make shorter':
      prompt = `Make the following text shorter while preserving the main points:
\n---\n${text}\n---\nShorter Text:`;
      break;
    case 'make longer':
      prompt = `Expand on the following text, adding relevant details or explanation:
\n---\n${text}\n---\nExpanded Text:`;
      break;
    // Add more actions here later (e.g., change tone, check consistency)
    default:
      return res.status(400).json({ message: `Unsupported AI action: ${action}` });
  }
  // ------------------------------

  // Use gemini-1.5-flash-latest model
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    // Optional: Add safety settings or generation config if needed
    // generationConfig: {
    //   temperature: 0.7,
    //   maxOutputTokens: 256,
    // },
    // safetySettings: [...] 
  };

  console.log(`User ${userId} requesting AI action '${action}'`);

  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });

    // --- Extract Text from Gemini Response ---
    // The structure might vary slightly based on model/version, adjust if needed
    let generatedText = '';
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      generatedText = response.data.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected Gemini API response structure:', response.data);
      throw new Error('Failed to parse AI response.');
    }
    // ----------------------------------------

    console.log(`AI action '${action}' completed successfully for user ${userId}`);
    res.status(200).json({ result: generatedText });

  } catch (error) {
    console.error(`Error calling Gemini API for action '${action}':`, error.response?.data || error.message);
    // Provide more specific error message if available from Gemini
    const errorMessage = error.response?.data?.error?.message || 'AI request failed.';
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ message: `AI service error: ${errorMessage}` });
  }
});

// --- Database Connection Test (keep as is) ---
async function testDbConnection() {
  try {
    // Perform a simple query to test connection
    const result = await db.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
  } catch (err) {
    console.error('!!! Database connection failed !!!:', err);
    // Optionally exit if DB connection is critical for startup
    // process.exit(1);
  }
}

// --- Start Server (keep as is) ---
app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
  testDbConnection();
});