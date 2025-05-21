import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

console.log('=== Database Configuration Initialization ===');
console.log('Loading environment variables...');

const {
  DB_USER,
  DB_HOST,
  DB_NAME = 'serafina_db',
  DB_PORT = 5432,
  DB_PASSWORD,
  NODE_ENV
} = process.env;

console.log('Environment variables loaded:', {
  DB_USER,
  DB_HOST,
  DB_NAME,
  DB_PORT,
  NODE_ENV
});

// Create connection pool
const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT,
  // Pool configuration
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log('Pool configuration:', {
  user: pool.options.user,
  host: pool.options.host,
  database: pool.options.database,
  port: pool.options.port
});

// Connection event handlers
pool.on('connect', (client) => {
  console.log('=== New Database Connection ===');
  console.log('Client connected:', {
    user: client.connectionParameters.user,
    database: client.connectionParameters.database,
    host: client.connectionParameters.host,
    pid: client.processID
  });
});

pool.on('error', (err) => {
  console.error('=== Database Pool Error ===');
  console.error('Error details:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });
});

// Test the connection
async function validateConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to database');
    const result = await client.query('SELECT current_database() as db, current_user as user');
    console.log('Database connection details:', result.rows[0]);
    client.release();
    return true;
  } catch (err) {
    console.error('Failed to validate database connection:', err);
    return false;
  }
}

// Initialize database tables
async function initDb() {
  console.log('=== Initializing Database Tables ===');
  try {
    const client = await pool.connect();
    
    // Log current tables
    const tablesQuery = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Existing tables:', tablesQuery.rows);

    // Check if files table exists
    const filesTableQuery = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'files'
      );
    `);
    console.log('Files table exists:', filesTableQuery.rows[0].exists);

    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL,
        user_id VARCHAR(100) DEFAULT '000',
        storage_path TEXT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        is_extracted BOOLEAN DEFAULT false,
        extracted_text TEXT
      )
    `);
    console.log('Database tables initialized successfully');
    client.release();
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Validate connection on startup
validateConnection();

export { pool as db, initDb }; 