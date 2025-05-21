export const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
  'application/csv': '.csv'  // Some systems use this MIME type for CSV
};

export function initializeFileUpload() {
  console.log('Initializing fileUpload component...');
  
  return {
    files: [],
    maxSize: 52428800, // 50MB in bytes
    dragActive: false,
    uploading: false,
    
    handleFiles(fileList) {
      console.log('handleFiles called with:', fileList);
      this.validateAndAddFiles(fileList);
    },
    
    async uploadFiles() {
      console.log('uploadFiles called with files:', this.files);
      if (this.files.length === 0) return;
      
      this.uploading = true;
      const formData = new FormData();
      
      this.files.forEach((file, index) => {
        console.log(`Adding file to FormData:`, {
          name: file.name,
          type: file.type,
          size: file.size
        });
        formData.append('files', file); // Changed to use 'files' as the field name
      });

      try {
        console.log('Sending upload request...');
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Upload failed:', errorData);
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        console.log('Upload successful:', result);

        // Clear files after successful upload
        this.files = [];
        alert('Files uploaded successfully!');
        
      } catch (error) {
        console.error('Upload error details:', error);
        alert(`Failed to upload files: ${error.message}`);
      } finally {
        this.uploading = false;
      }
    },

    validateAndAddFiles(fileList) {
      console.log('validateAndAddFiles called with:', fileList);
      const files = [...fileList];
      const invalidFiles = [];

      files.forEach(file => {
        // Validate file type
        if (!SUPPORTED_FILE_TYPES[file.type]) {
          invalidFiles.push(`${file.name} has unsupported file type. Supported types: PDF, PNG, JPEG, Excel, and CSV`);
          return;
        }

        // Validate file size
        if (file.size > this.maxSize) {
          invalidFiles.push(`${file.name} exceeds 50MB limit`);
          return;
        }

        this.files.push(file);
      });

      if (invalidFiles.length > 0) {
        alert('Some files were not added:\n' + invalidFiles.join('\n'));
      }
    }
  };
} 