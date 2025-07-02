const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load environment variables from a .dev.vars file
require('dotenv').config({ path: path.resolve(process.cwd(), '.dev.vars') });

const applySchema = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not defined in your .env file.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for Neon
  });

  try {
    console.log('Connecting to the database...');
    await client.connect();
    console.log('Connected successfully.');

    const schemaSqlPath = path.join(__dirname, '..', 'schema.sql');
    console.log(`Reading schema file from: ${schemaSqlPath}`);
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

    console.log('Applying schema...');
    await client.query(schemaSql);
    console.log('Schema applied successfully!');

  } catch (err) {
    console.error('Error applying schema:', err);
    process.exit(1);
  } finally {
    console.log('Closing database connection.');
    await client.end();
  }
};

applySchema(); 