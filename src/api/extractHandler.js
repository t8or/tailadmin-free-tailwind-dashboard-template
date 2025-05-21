import express from 'express';
import path from 'path';
import { FileProcessor } from '../services/file_processor.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db } from '../config/database.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// Force reload environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const processor = new FileProcessor('uploads/extracted');

// Add logging middleware
router.use((req, res, next) => {
  console.log('\n=== Extract Handler Request ===');
  console.log('Environment State:', {
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    NODE_ENV: process.env.NODE_ENV,
    CWD: process.cwd()
  });
  console.log('Pool Config:', db.options);
  next();
});

router.post('/extract/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log('\n=== Starting Extraction Process ===');
    console.log('Processing file ID:', fileId);
    console.log('Current pool state:', {
      totalCount: db.totalCount,
      idleCount: db.idleCount,
      waitingCount: db.waitingCount
    });

    // Get the file details from the database
    console.log('Attempting database query...');
    const fileQuery = await db.query(
      'SELECT original_filename, storage_path as file_path, file_type FROM files WHERE id = $1',
      [fileId]
    );
    console.log('Database query completed');

    if (fileQuery.rows.length === 0) {
      console.error('File not found in database');
      throw new Error('File not found in database');
    }

    const { file_path, original_filename, file_type } = fileQuery.rows[0];
    console.log('File details from DB:', { file_path, original_filename, file_type });
    
    // Get the absolute file path using UPLOAD_DIR
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const filePath = path.resolve(process.cwd(), uploadDir, file_path);
    console.log('Resolved file path:', filePath);

    // Check if file exists
    try {
      await fs.access(filePath);
      console.log('File exists at path:', filePath);
    } catch (error) {
      console.error('File does not exist at path:', filePath);
      throw new Error(`File not found at path: ${filePath}`);
    }
    
    // Generate the output path with 'e_' prefix
    const outputFileName = `e_${path.basename(original_filename, path.extname(original_filename))}.json`;
    const outputPath = path.join(process.cwd(), 'uploads/extracted', outputFileName);
    console.log('Output will be saved to:', outputPath);

    // Process the file
    console.log('Starting file processing...', { filePath, file_type });
    const result = await processor.process_file(filePath, original_filename);
    console.log('Processing result:', result);

    if (result.processing_status === 'error') {
      console.error('Processing error:', result.error_message);
      throw new Error(result.error_message);
    }

    res.json({
      success: true,
      message: 'Text extracted successfully',
      outputPath: outputPath,
      result: result
    });

  } catch (error) {
    console.error('\n=== Extraction Error ===');
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router; 