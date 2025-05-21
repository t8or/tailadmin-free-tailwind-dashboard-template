import { createRequire } from 'module';
import { BaseProcessor } from './base_processor.js';

const require = createRequire(import.meta.url);
const tesseract = require('node-tesseract-ocr');

class ImageProcessor extends BaseProcessor {
  constructor(ollamaService) {
    super(ollamaService);
    
    // Configure Tesseract options
    this.tesseractConfig = {
      lang: 'eng',
      oem: 1,
      psm: 3
    };
  }

  async process(imagePath) {
    try {
      console.log('Processing image:', imagePath);
      
      // Perform OCR
      const ocrText = await tesseract.recognize(imagePath, this.tesseractConfig);
      console.log('OCR processing completed');
      
      // Clean up the extracted text
      const cleanedText = this.cleanupTextData(ocrText);
      
      // Get image metadata using Node's fs
      const metadata = await this.getImageMetadata(imagePath);
      
      // Process with Ollama
      const processedData = {
        text: cleanedText,
        metadata: {
          ...metadata,
          file_type: 'image'
        }
      };

      const analysis = await this.ollamaService.analyzePropertyData(processedData, 'image');
      
      return this.createSuccessResult(analysis, processedData.metadata);
    } catch (error) {
      console.error('Error processing image:', error);
      return this.createErrorResult(error);
    }
  }

  async getImageMetadata(imagePath) {
    try {
      const sharp = require('sharp');
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        compression: metadata.compression,
        hasAlpha: metadata.hasAlpha
      };
    } catch (error) {
      console.warn('Error getting image metadata:', error);
      return {
        format: 'unknown',
        error: error.message
      };
    }
  }
}

export { ImageProcessor }; 