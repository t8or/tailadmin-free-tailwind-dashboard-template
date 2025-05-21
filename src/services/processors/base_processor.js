class BaseProcessor {
  constructor(ollamaService) {
    this.ollamaService = ollamaService;
  }

  async process(filePath) {
    throw new Error('process method must be implemented by child class');
  }

  normalizeValue(value) {
    if (!value || typeof value !== 'string') return null;
    
    value = value.trim();
    
    // Handle special cases in reports
    if (value === '-' || value.toLowerCase() === 'n/a') return null;
    
    // Extract numbers from strings like "183 Units" or "863 SF"
    const numberMatch = value.match(/^(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:Units?|SF|Spaces?)?$/i);
    if (numberMatch) {
      return parseFloat(numberMatch[1].replace(/,/g, ''));
    }
    
    // Handle currency with per unit values like "$27,450,000 ($150,000/Unit)"
    const currencyMatch = value.match(/\$([0-9,]+(?:\.\d+)?)/);
    if (currencyMatch) {
      return parseFloat(currencyMatch[1].replace(/,/g, ''));
    }
    
    // Handle percentages
    if (value.endsWith('%')) {
      return parseFloat(value) / 100;
    }
    
    // Handle dates
    if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(value)) {
      return new Date(value).toISOString().split('T')[0];
    }
    
    return value;
  }

  removeDocumentArtifacts(text) {
    return text
      // Remove binary and control characters except tabs and newlines
      .replace(/\x00+/g, '')
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      // Preserve embedded content
      .replace(/\[embed\](.*?)\[\/embed\]/gs, '$1')
      .replace(/\[binary content\](.*?)\[\/binary content\]/gs, '$1')
      // Preserve copyright notices but remove redundant ones
      .replace(/(?:©.*?(?:\r?\n|$))+/g, match => match.split('\n')[0] + '\n')
      // Clean up headers/footers while preserving date information
      .replace(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?.*$/gm, '$1')
      // Preserve page numbers
      .replace(/\bPage\s+(\d+)\s*(?:\r?\n|$)/g, '[[Page $1]]\n')
      // Standardize form field markers
      .replace(/\[X\]|\[\s\]/g, '[✓]')
      // Clean up file paths while preserving filename
      .replace(/(?:\/|\\)([\w\s\-\.]+)(?:\/|\\)/g, '[$1]')
      // Preserve document structure
      .replace(/\n{4,}/g, '\n\n\n')
      // Clean up special characters while preserving meaningful whitespace
      .replace(/[^\x20-\x7E\n\t]/g, ' ')
      .trim();
  }

  cleanupTextData(text) {
    // Remove artifacts while preserving structure
    text = this.removeDocumentArtifacts(text);
    
    // Split into sections
    const sections = this.splitIntoSections(text);
    
    // Process each section
    const processedSections = sections.map(section => {
      const lines = section.split('\n');
      const header = lines[0].trim();
      const content = lines.slice(1);
      
      if (this.isTableSection(header)) {
        return this.processTableSection(header, content);
      } else if (this.isKeyValueSection(header)) {
        return this.processKeyValueSection(header, content);
      } else {
        return this.processGeneralSection(header, content);
      }
    });
    
    return processedSections.join('\n\n');
  }
  
  splitIntoSections(text) {
    const sections = [];
    let currentSection = [];
    let inTable = false;
    let skipNextLine = false;
    
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip orphaned unit counts
      if (/^\d+\s*Units?$/.test(trimmedLine)) {
        skipNextLine = true;
        continue;
      }
      
      if (skipNextLine) {
        skipNextLine = false;
        continue;
      }
      
      // Keep original whitespace for table structure
      if (this.looksLikeTable(line)) {
        inTable = true;
        if (currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
          currentSection = [];
        }
      }
      
      if (this.isSectionHeader(trimmedLine) && !inTable) {
        if (currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
          currentSection = [];
        }
      }
      
      if (inTable && this.isTableEnd(line)) {
        inTable = false;
      }
      
      // Preserve original line with spacing for tables
      currentSection.push(inTable ? line : trimmedLine);
    }
    
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
    
    return sections;
  }
  
  looksLikeTable(line) {
    return (
      // Multiple columns with consistent spacing
      /\S+\s{2,}\S+/.test(line) ||
      // Table borders
      /^[\-+|]+$/.test(line) ||
      // Aligned numbers or currency
      /^\s*\d+\s+\$?\d/.test(line)
    );
  }
  
  isSectionHeader(line) {
    return (
      // All caps sections
      /^[A-Z][A-Z\s]{3,}$/.test(line) ||
      // Numbered sections
      /^(?:\d+\.)*\d+\s+[A-Z]/.test(line) ||
      // Common section markers
      /^(?:SECTION|PART|CHAPTER)\s+\w+/i.test(line) ||
      // Known section headers
      ['PROPERTY', 'OWNER', 'VACANCY', 'ASKING RENTS', 'ABSORPTION', 'OCCUPANCY', 'LEASE EXPIRY', 'UNIT MIX'].some(header => 
        line.toUpperCase().includes(header)
      )
    );
  }
  
  isTableSection(header) {
    return [
      'UNIT MIX',
      'RENT ROLL',
      'LEASE EXPIRY',
      'MARKET SURVEY',
      'ASKING RENTS'
    ].some(marker => header.toUpperCase().includes(marker));
  }
  
  isKeyValueSection(header) {
    return [
      'PROPERTY',
      'OWNER',
      'VACANCY',
      'ABSORPTION',
      'OCCUPANCY'
    ].some(marker => header.toUpperCase().includes(marker));
  }
  
  processTableSection(header, content) {
    const result = [header];
    let columnWidths = [];
    let headers = [];
    
    // First pass: determine column widths and headers
    for (const line of content) {
      if (!line.trim()) continue;
      
      const columns = this.splitTableRow(line);
      columnWidths = columnWidths.map((w, i) => Math.max(w || 0, (columns[i] || '').length));
      
      if (this.isTableHeaderRow(line)) {
        headers = columns;
      }
    }
    
    // Second pass: format rows with consistent spacing
    for (const line of content) {
      if (!line.trim()) continue;
      
      const columns = this.splitTableRow(line);
      const formattedColumns = columns.map((col, i) => col.padEnd(columnWidths[i] || col.length));
      result.push(formattedColumns.join('  '));
    }
    
    return result.join('\n');
  }
  
  splitTableRow(line) {
    // Split on 2 or more spaces while preserving internal single spaces
    return line.split(/(?<=\S)[ ]{2,}(?=\S)/).map(col => col.trim());
  }
  
  isTableHeaderRow(line) {
    return (
      /\s{2,}/.test(line) &&
      !/^\s*\d/.test(line) &&
      /(?:TYPE|SIZE|UNITS?|RENT|DATE|TOTAL)/i.test(line)
    );
  }
  
  processKeyValueSection(header, content) {
    const result = [header];
    const entries = new Map();
    
    // Pre-process: filter out orphaned unit counts
    content = content.filter(line => {
      const trimmed = line.trim();
      return !(/^\d+\s*Units?$/.test(trimmed));
    });
    
    // Process key-value pairs
    let currentKey = null;
    for (const line of content) {
      if (!line.trim()) continue;
      
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        currentKey = key.trim();
        
        if (!entries.has(currentKey)) {
          entries.set(currentKey, { value: value.trim(), related: [] });
        }
      } else {
        // Try to find a matching key for other lines
        for (const [key, entry] of entries) {
          if (line.toLowerCase().includes(key.toLowerCase())) {
            entry.related.push(line.trim());
            break;
          }
        }
      }
    }
    
    // Format entries in consistent order
    const orderedKeys = ['Current', 'Last Quarter', 'Year Ago', 'Competitors', 'Submarket'];
    const sortedEntries = Array.from(entries.entries())
      .sort(([keyA], [keyB]) => {
        const indexA = orderedKeys.indexOf(keyA);
        const indexB = orderedKeys.indexOf(keyB);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    
    // Format and add entries
    for (const [key, data] of sortedEntries) {
      result.push(`${key}: ${data.value}`);
      for (const related of data.related) {
        result.push(`  ${related}`);
      }
    }
    
    return result.join('\n');
  }
  
  formatComplexValue(value) {
    // Handle currency with unit rates
    if (value.includes('$') && value.includes('/')) {
      const parts = value.split(/(?<=\S)\s+(?=\$)/);
      return parts.join('  ');
    }
    
    // Handle percentage with unit counts
    if (value.includes('%') && value.toLowerCase().includes('unit')) {
      const parts = value.split(/(?<=\%)\s+(?=\d)/);
      return parts.join('  ');
    }
    
    return value;
  }
  
  processGeneralSection(header, content) {
    return [header, ...content.map(line => line.trim())].join('\n');
  }
  
  isTableEnd(line) {
    return (
      !line.trim() ||
      this.isSectionHeader(line.trim()) ||
      /^[\-=]{3,}$/.test(line.trim())
    );
  }

  createErrorResult(error) {
    return {
      processing_status: 'error',
      error_message: error.message,
      error_stack: error.stack
    };
  }

  createSuccessResult(data, metadata = {}) {
    return {
      processing_status: 'success',
      metadata: {
        creation_date: new Date().toISOString(),
        ...metadata
      },
      data
    };
  }
}

export { BaseProcessor }; 