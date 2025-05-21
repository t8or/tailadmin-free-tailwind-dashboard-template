import { createRequire } from 'module';
import { BaseProcessor } from './base_processor.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

class ExcelProcessor extends BaseProcessor {
  constructor(ollamaService) {
    super(ollamaService);
  }

  async process(filePath) {
    try {
      console.log('Processing Excel file:', filePath);
      
      // Read and parse Excel file
      const workbook = XLSX.readFile(filePath);
      const sheets = [];
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        console.log(`Processing sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        // Structure the data
        const structuredData = this.structureExcelData(data);
        
        sheets.push({
          name: sheetName,
          raw_data: data,
          structured_data: structuredData,
          statistics: this.generateSheetStatistics(data)
        });
      }
      
      // Get file metadata
      const metadata = {
        file_type: 'excel',
        sheet_count: sheets.length,
        sheets: sheets.map(sheet => ({
          name: sheet.name,
          row_count: sheet.raw_data.length,
          columns: sheet.raw_data[0] ? Object.keys(sheet.raw_data[0]) : []
        }))
      };
      
      // Process with Ollama
      const processedData = {
        sheets,
        metadata
      };

      const analysis = await this.ollamaService.analyzePropertyData(processedData, 'excel');
      
      return this.createSuccessResult(analysis, metadata);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      return this.createErrorResult(error);
    }
  }

  structureExcelData(data) {
    // Initialize categories (similar to CSV processor)
    const structured = {
      property_info: [],
      financial_data: [],
      unit_mix: [],
      amenities: [],
      location_data: [],
      other: []
    };

    // Helper function to categorize columns
    const categorizeColumn = (column) => {
      column = column.toLowerCase();
      if (/property|name|address|year|built|size|units?/.test(column)) return 'property_info';
      if (/price|income|expense|rent|rate|cost|value/.test(column)) return 'financial_data';
      if (/bed|bath|sqft|mix|floor\s*plan/.test(column)) return 'unit_mix';
      if (/amenity|feature|facility/.test(column)) return 'amenities';
      if (/location|market|area|region|city|state|zip/.test(column)) return 'location_data';
      return 'other';
    };

    // Process each record
    data.forEach(record => {
      const categorizedData = {
        property_info: {},
        financial_data: {},
        unit_mix: {},
        amenities: {},
        location_data: {},
        other: {}
      };

      // Categorize each field
      Object.entries(record).forEach(([key, value]) => {
        const category = categorizeColumn(key);
        categorizedData[category][key] = this.normalizeValue(value?.toString() || '');
      });

      // Add non-empty categories to structured data
      Object.entries(categorizedData).forEach(([category, data]) => {
        if (Object.keys(data).length > 0) {
          structured[category].push(data);
        }
      });
    });

    return structured;
  }

  generateSheetStatistics(data) {
    if (!data.length) return {};
    
    const stats = {};
    const columns = Object.keys(data[0]);

    columns.forEach(column => {
      const values = data.map(r => r[column]).filter(v => v != null);
      const numericValues = values.filter(v => !isNaN(v));
      
      stats[column] = {
        dtype: numericValues.length === values.length ? 'numeric' : 'string',
        null_count: data.length - values.length,
        unique_values: new Set(values).size
      };

      // Add numeric statistics if applicable
      if (numericValues.length > 0) {
        stats[column] = {
          ...stats[column],
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          median: this.calculateMedian(numericValues)
        };
      }
    });

    return stats;
  }

  calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
}

export { ExcelProcessor }; 