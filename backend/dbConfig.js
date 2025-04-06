// backend/dbConfig.js
const { Pool } = require('pg');
require('dotenv').config(); // Ensure environment variables are loaded

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Optional settings:
  // max: 20, // max number of clients in the pool
  // idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  // connectionTimeoutMillis: 2000, // how long to wait for a connection acquisition before timing out
});

pool.on('connect', () => {
  console.log('Database pool connected');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1); // Exit the process if pool errors out
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export pool if needed elsewhere (e.g., for transactions)
};