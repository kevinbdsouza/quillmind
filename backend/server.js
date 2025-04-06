// quillmind/backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./dbConfig'); // Make sure dbConfig is imported
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5001;

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

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