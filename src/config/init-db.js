import { db } from './database.js';

async function initializeDatabase() {
  try {
    console.log('Creating files table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL,
        user_id VARCHAR(100) DEFAULT '000',
        storage_path TEXT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active'
      )
    `);
    
    console.log('Files table created successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase(); 