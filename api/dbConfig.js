// api/dbConfig.js
export const query = async (text, params, env) => {
  if (!env.DB) {
    throw new Error("Database binding not found.");
  }

  // D1 syntax uses '?' for placeholders, not '$1', '$2', etc.
  // We need to convert the query text.
  const d1Query = text.replace(/\$\d+/g, '?');

  try {
    const stmt = env.DB.prepare(d1Query).bind(...params);
    const { results } = await stmt.all();
    // D1 returns an array of objects, which is compatible with what the app expects.
    return { rows: results }; 
  } catch (err) {
    console.error('Error executing query with D1:', {
      message: err.message,
      stack: err.stack,
    });
    throw err;
  }
};