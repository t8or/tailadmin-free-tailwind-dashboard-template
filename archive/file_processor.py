import os
import logging
from typing import Dict, Any, Optional
from .image_processor import ImageProcessor
from .pdf_processor import PDFProcessor
from .csv_processor import CSVProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('file_processor')

class FileProcessor:
    def __init__(self, output_dir: str = "processed_files"):
        """
        Initialize the file processor with all available processors.
        
        Args:
            output_dir (str): Directory where processed files will be saved
        """
        self.image_processor = ImageProcessor()
        self.pdf_processor = PDFProcessor()
        self.csv_processor = CSVProcessor()
        self.output_dir = output_dir
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)

    def process_file(self, file_path: str) -> Dict[str, Any]:
        """
        Process a file based on its extension and return the results.
        
        Args:
            file_path (str): Path to the file to process
            
        Returns:
            Dict[str, Any]: Processing results in a structured format
        """
        try:
            # Get file extension
            _, ext = os.path.splitext(file_path)
            ext = ext.lower()
            
            # Generate output path
            base_name = os.path.basename(file_path)
            output_path = os.path.join(
                self.output_dir,
                f"{os.path.splitext(base_name)[0]}_processed.json"
            )
            
            # Process based on file type
            result = None
            if ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
                result = self.image_processor.process_image(file_path)
                self.image_processor.save_output(result, output_path)
            
            elif ext == '.pdf':
                result = self.pdf_processor.process_pdf(file_path)
                self.pdf_processor.save_output(result, output_path)
            
            elif ext == '.csv':
                result = self.csv_processor.process_csv(file_path)
                self.csv_processor.save_output(result, output_path)
            
            else:
                error_msg = f"Unsupported file type: {ext}"
                logger.error(error_msg)
                return {
                    "processing_status": "error",
                    "error_message": error_msg
                }
            
            logger.info(f"Successfully processed file: {file_path}")
            return {
                "processing_status": "success",
                "output_path": output_path,
                "results": result
            }
            
        except Exception as e:
            error_msg = f"Error processing file {file_path}: {str(e)}"
            logger.error(error_msg)
            return {
                "processing_status": "error",
                "error_message": error_msg
            }

    def batch_process(self, file_paths: list[str]) -> Dict[str, Any]:
        """
        Process multiple files and return their results.
        
        Args:
            file_paths (list[str]): List of file paths to process
            
        Returns:
            Dict[str, Any]: Processing results for all files
        """
        results = {}
        for file_path in file_paths:
            results[file_path] = self.process_file(file_path)
        
        return {
            "batch_results": results,
            "total_files": len(file_paths),
            "successful": sum(1 for r in results.values() if r["processing_status"] == "success"),
            "failed": sum(1 for r in results.values() if r["processing_status"] == "error")
        } 