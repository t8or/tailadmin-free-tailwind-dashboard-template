import { readFile } from 'fs/promises';
import { BaseProcessor } from './base_processor.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

/**
 * PDFProcessor class extends BaseProcessor to handle PDF document processing
 * Only handles PDF-specific tasks: reading PDF, detecting pages and tables
 */
export class PDFProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  /**
   * Main processing function that handles PDF text extraction and table detection
   * @param {string} filePath - Path to the PDF file to process
   * @returns {Object} Result containing pages and detected tables
   */
  async process(filePath) {
    try {
      // Read and parse the PDF
      const rawPages = await this.readPDF(filePath);
      
      // First detect tables in the raw text (before cleaning)
      const tables = this.detectTables(rawPages);
      
      // Then clean the pages, preserving detected tables
      const cleanedPages = rawPages.map((page, pageIndex) => {
        const pageTables = tables.filter(t => t.pageIndex === pageIndex);
        return this.cleanPagePreservingTables(page, pageTables);
      });

      return {
        pages: cleanedPages,
        tables: tables
      };
    } catch (error) {
      console.error('Error in PDF processing:', error);
      throw error;
    }
  }

  /**
   * Reads and parses a PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Array<string>>} Array of pages from the PDF
   */
  async readPDF(filePath) {
    try {
      const dataBuffer = await readFile(filePath);
      const data = await pdf(dataBuffer);
      
      // Split text into pages
      const pages = data.text.split(/\f|\r?\n(?:\r?\n\s*){2,}/);
      
      // Filter out empty pages but don't trim yet to preserve table structure
      return pages.filter(page => page.length > 0);
    } catch (error) {
      console.error('Error reading PDF:', error);
      throw error;
    }
  }

  /**
   * Detects tables in the text based on common patterns
   * @param {string[]} pages - Array of page contents
   * @returns {Array<Object>} Detected tables with their locations
   */
  detectTables(pages) {
    const tables = [];
    
    pages.forEach((page, pageIndex) => {
      // Split into lines but don't trim to preserve spacing
      const lines = page.split('\n');
      
      let currentTable = null;
      let columnPositions = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip empty or nearly empty lines
        if (!line.trim()) continue;
        
        // Find potential column positions based on consistent spacing
        const positions = this.findColumnPositions(line);
        
        // Check if this line matches table patterns
        const isTableRow = 
          // Has tabs
          line.includes('\t') ||
          // Has consistent multiple spaces indicating columns
          (positions.length >= 2 && /\s{3,}/.test(line)) ||
          // Has multiple numeric/currency/percentage columns
          /(?:\d+(?:\.\d+)?|\$[\d,.]+|\d+%)\s{2,}(?:\d+(?:\.\d+)?|\$[\d,.]+|\d+%)/.test(line) ||
          // Has header-like format (capitalized words with consistent spacing)
          /^[A-Z][a-zA-Z]*(?:\s{2,}[A-Z][a-zA-Z]*){2,}$/.test(line) ||
          // Matches previous column positions (if in a table)
          (currentTable && this.matchesColumnPositions(line, columnPositions));
        
        if (isTableRow) {
          if (!currentTable) {
            currentTable = {
              pageIndex,
              startLine: i,
              content: [],
              columnPositions: positions
            };
            columnPositions = positions;
          } else {
            // Update column positions to be more accurate
            columnPositions = this.mergeColumnPositions(columnPositions, positions);
          }
          currentTable.content.push(line);
        } else if (currentTable && currentTable.content.length >= 3) {
          // End current table if we have enough rows
          currentTable.endLine = i - 1;
          // Add column information
          currentTable.columns = this.analyzeTableColumns(currentTable.content);
          tables.push(currentTable);
          currentTable = null;
          columnPositions = [];
        } else {
          // Reset if we don't have enough rows
          currentTable = null;
          columnPositions = [];
        }
      }
      
      // Handle table at end of page
      if (currentTable && currentTable.content.length >= 3) {
        currentTable.endLine = lines.length - 1;
        currentTable.columns = this.analyzeTableColumns(currentTable.content);
        tables.push(currentTable);
      }
    });

    return tables;
  }

  /**
   * Find potential column positions based on consistent spacing
   * @param {string} line - Line of text to analyze
   * @returns {number[]} Array of column start positions
   */
  findColumnPositions(line) {
    const positions = [0]; // First column always starts at 0
    let inWord = false;
    
    // Find gaps of 2 or more spaces
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') {
        if (inWord && i + 2 < line.length && line[i + 1] === ' ' && line[i + 2] !== ' ') {
          positions.push(i + 2);
        }
        inWord = false;
      } else {
        inWord = true;
      }
    }
    
    return positions;
  }

  /**
   * Check if a line matches the expected column positions
   * @param {string} line - Line to check
   * @param {number[]} positions - Expected column positions
   * @returns {boolean} True if the line matches the column structure
   */
  matchesColumnPositions(line, positions) {
    if (!positions.length) return false;
    
    // Allow some flexibility in position matching
    const tolerance = 1;
    
    // Check if content exists at or near each position
    return positions.every((pos, idx) => {
      if (idx === 0) return true; // Skip first position
      
      // Look for non-space character within tolerance
      for (let i = Math.max(0, pos - tolerance); i <= Math.min(line.length - 1, pos + tolerance); i++) {
        if (line[i] !== ' ') return true;
      }
      return false;
    });
  }

  /**
   * Merge two sets of column positions, keeping the most consistent ones
   * @param {number[]} existing - Existing column positions
   * @param {number[]} new - New column positions
   * @returns {number[]} Merged column positions
   */
  mergeColumnPositions(existing, newPos) {
    if (!existing.length) return newPos;
    if (!newPos.length) return existing;
    
    // Use weighted average, favoring existing positions
    return existing.map((pos, idx) => {
      if (idx >= newPos.length) return pos;
      return Math.round((pos * 2 + newPos[idx]) / 3);
    });
  }

  /**
   * Analyze table columns to determine their types and alignment
   * @param {string[]} rows - Table rows
   * @returns {Array<Object>} Column information
   */
  analyzeTableColumns(rows) {
    if (rows.length < 2) return [];
    
    const columnData = [];
    const headerRow = rows[0];
    const positions = this.findColumnPositions(headerRow);
    
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i];
      const end = i < positions.length - 1 ? positions[i + 1] : undefined;
      
      const values = rows.map(row => {
        const value = end ? row.slice(start, end).trim() : row.slice(start).trim();
        return value;
      });
      
      columnData.push({
        header: values[0],
        type: this.determineColumnType(values.slice(1)),
        alignment: this.determineAlignment(values)
      });
    }
    
    return columnData;
  }

  /**
   * Determine the type of data in a column
   * @param {string[]} values - Column values
   * @returns {string} Column type
   */
  determineColumnType(values) {
    const nonEmpty = values.filter(v => v.trim());
    if (!nonEmpty.length) return 'empty';
    
    const numeric = nonEmpty.every(v => /^-?\d+(?:\.\d+)?$/.test(v.replace(/,/g, '')));
    if (numeric) return 'numeric';
    
    const currency = nonEmpty.every(v => /^\$[\d,.]+$/.test(v));
    if (currency) return 'currency';
    
    const percentage = nonEmpty.every(v => /^\d+(?:\.\d+)?%$/.test(v));
    if (percentage) return 'percentage';
    
    return 'text';
  }

  /**
   * Determine the alignment of a column
   * @param {string[]} values - Column values
   * @returns {string} Alignment type
   */
  determineAlignment(values) {
    const nonEmpty = values.filter(v => v.trim());
    if (!nonEmpty.length) return 'left';
    
    // Check if all values are right-aligned (common for numbers)
    const rightAligned = nonEmpty.every(v => v.startsWith(' '));
    if (rightAligned) return 'right';
    
    // Check if all values are center-aligned
    const centerAligned = nonEmpty.every(v => v.startsWith(' ') && v.endsWith(' '));
    if (centerAligned) return 'center';
    
    return 'left';
  }

  /**
   * Cleans page text while preserving detected tables
   * @param {string} pageText - Raw page text
   * @param {Array<Object>} pageTables - Tables detected in the page
   * @returns {string} Cleaned text with preserved tables
   */
  cleanPagePreservingTables(pageText, pageTables) {
    if (!pageTables || pageTables.length === 0) {
      return this.cleanupTextData(pageText);
    }

    const lines = pageText.split('\n');
    const cleanedLines = lines.map((line, index) => {
      // Check if this line is part of a table
      const isTableLine = pageTables.some(table => 
        index >= table.startLine && index <= table.endLine
      );
      
      // Only clean non-table lines
      return isTableLine ? line : this.cleanupTextData(line);
    });

    return cleanedLines.join('\n');
  }
} 