import { createRequire } from 'module';
import { BaseProcessor } from './base_processor.js';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { promisify } from 'util';

const parseAsync = promisify(parse);

class CSVProcessor extends BaseProcessor {
  constructor(ollamaService) {
    super(ollamaService);
  }

  async process(csvPath) {
    try {
      console.log('Processing CSV:', csvPath);
      
      // Read and parse CSV
      const content = await fs.readFile(csvPath, 'utf-8');
      const records = await parseAsync(content, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
        trim: true
      });
      
      // Structure the data
      const structuredData = this.structureCSVData(records);
      
      // Get file metadata
      const metadata = {
        file_type: 'csv',
        row_count: records.length,
        column_count: Object.keys(records[0] || {}).length,
        columns: Object.keys(records[0] || {}),
        file_size: (await fs.stat(csvPath)).size
      };
      
      // Get column statistics
      const columnStats = this.generateColumnStatistics(records);
      
      // Process with Ollama
      const processedData = {
        raw_records: records,
        structured_data: structuredData,
        column_statistics: columnStats,
        metadata
      };

      const analysis = await this.ollamaService.analyzePropertyData(processedData, 'csv');
      
      return this.createSuccessResult(analysis, metadata);
    } catch (error) {
      console.error('Error processing CSV:', error);
      return this.createErrorResult(error);
    }
  }

  structureCSVData(records) {
    // Initialize categories
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
    records.forEach(record => {
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

  generateColumnStatistics(records) {
    if (!records.length) return {};
    
    const stats = {};
    const columns = Object.keys(records[0]);

    columns.forEach(column => {
      const values = records.map(r => r[column]).filter(v => v != null);
      const numericValues = values.filter(v => !isNaN(v));
      
      stats[column] = {
        dtype: numericValues.length === values.length ? 'numeric' : 'string',
        null_count: records.length - values.length,
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

export { CSVProcessor }; 