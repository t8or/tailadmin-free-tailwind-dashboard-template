import { BaseProcessor } from './services/processors/base_processor.js';
import { OllamaService } from './services/ollama_service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

// Test file path that will be used across all tests
const TEST_FILE_PATH = path.join(workspaceRoot, 'uploads', 'documents', '1740777211993-d7gb6q.pdf');
const OUTPUT_DIR = path.join(workspaceRoot, 'processed_files');

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR);
  }
}

async function readPDFContent(filePath) {
  const dataBuffer = await fs.promises.readFile(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

async function writeTestOutput(result, testNumber, isText = false) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = path.basename(TEST_FILE_PATH);
  const extension = isText ? 'txt' : 'json';
  const outputFilename = `test${testNumber}_${baseFilename}_${timestamp}.${extension}`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  
  const content = isText ? result : JSON.stringify(result, null, 2);
  await writeFile(outputPath, content);
  return outputPath;
}

async function testBaseProcessor() {
  console.log('\n=== Test 1: Base Processor Only ===');
  try {
    const baseProcessor = new BaseProcessor();
    
    // Read PDF content
    console.log('Reading PDF content...');
    const content = await readPDFContent(TEST_FILE_PATH);
    
    // Process with base processor - only clean the text
    console.log('Processing with BaseProcessor...');
    const cleanedContent = baseProcessor.cleanupTextData(content);
    
    // Write output as plain text
    const outputPath = await writeTestOutput(cleanedContent, 1, true);
    console.log('Test 1 output saved to:', outputPath);
    return cleanedContent;
  } catch (error) {
    console.error('Test 1 failed:', error);
    return null;
  }
}

async function testFullProcessing() {
  console.log('\n=== Test 3: Full Processing Stack ===');
  try {
    console.log('Processing with full stack...');
    
    // First use BaseProcessor to clean the text
    const baseProcessor = new BaseProcessor();
    const content = await readPDFContent(TEST_FILE_PATH);
    const cleanedText = baseProcessor.cleanupTextData(content);
    
    // Then analyze with OllamaService
    console.log('Analyzing with OllamaService...');
    const ollamaService = new OllamaService();
    const analysis = await ollamaService.analyzePropertyData({
      text: cleanedText,
      section: 'full_document',
      tables: [],
      page_number: 1
    }, 'pdf');
    
    // Write output
    const outputPath = await writeTestOutput(analysis, 3);
    console.log('Test 3 output saved to:', outputPath);
    return analysis;
  } catch (error) {
    console.error('Test 3 failed:', error);
    return null;
  }
}

async function runAllTests() {
  console.log('=== Starting PDF Processing Tests ===');
  console.log('Using test file:', TEST_FILE_PATH);
  
  // Ensure the output directory exists
  await ensureOutputDir();
  
  // Run tests sequentially
  const test1Result = await testBaseProcessor();
  console.log('Test 1 completed:', test1Result ? '✅' : '❌');
  
  const test3Result = await testFullProcessing();
  console.log('Test 3 completed:', test3Result ? '✅' : '❌');
  
  console.log('\nAll tests completed. Check the processed_files directory for outputs.');
}

// Run all tests
runAllTests(); 