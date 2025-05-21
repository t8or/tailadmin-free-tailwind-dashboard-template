import os
import json
import logging
from typing import Dict, Any, List
from io import StringIO
from pdfminer.high_level import extract_text_to_fp
from pdfminer.layout import LAParams
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.converter import TextConverter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('pdf_processor')

class PDFProcessor:
    def __init__(self):
        self.resource_manager = PDFResourceManager()
        self.laparams = LAParams(
            line_margin=0.5,
            word_margin=0.1,
            char_margin=2.0,
            all_texts=True
        )

    def extract_text_from_page(self, pdf_file, page) -> str:
        """
        Extract text from a single PDF page.
        
        Args:
            pdf_file: File object of the PDF
            page: PDFPage object
            
        Returns:
            str: Extracted text from the page
        """
        output = StringIO()
        converter = TextConverter(
            self.resource_manager,
            output,
            laparams=self.laparams
        )
        interpreter = PDFPageInterpreter(self.resource_manager, converter)
        interpreter.process_page(page)
        text = output.getvalue()
        converter.close()
        output.close()
        return text

    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Process a PDF file and return structured JSON output.
        
        Args:
            pdf_path (str): Path to the PDF file
            
        Returns:
            Dict[str, Any]: Structured data containing extracted text and metadata
        """
        try:
            pages_content = []
            total_pages = 0
            
            with open(pdf_path, 'rb') as file:
                # Get page count and metadata
                pages = list(PDFPage.get_pages(file))
                total_pages = len(pages)
                
                # Reset file pointer
                file.seek(0)
                
                # Process each page
                for page_num, page in enumerate(PDFPage.get_pages(file), 1):
                    text = self.extract_text_from_page(file, page)
                    
                    # Structure the page content
                    page_data = {
                        "page_number": page_num,
                        "content": text.strip(),
                        "word_count": len(text.split())
                    }
                    pages_content.append(page_data)
            
            # Structure the output
            result = {
                "metadata": {
                    "total_pages": total_pages,
                    "file_name": os.path.basename(pdf_path),
                    "file_size": os.path.getsize(pdf_path)
                },
                "pages": pages_content,
                "processing_status": "success"
            }
            
            logger.info(f"Successfully processed PDF: {pdf_path}")
            return result
            
        except Exception as e:
            error_msg = f"Error processing PDF {pdf_path}: {str(e)}"
            logger.error(error_msg)
            return {
                "processing_status": "error",
                "error_message": error_msg,
                "pages": [],
                "metadata": {}
            }

    def save_output(self, output_data: Dict[str, Any], output_path: str) -> None:
        """
        Save the processed data to a JSON file.
        
        Args:
            output_data (Dict[str, Any]): The processed data to save
            output_path (str): Path where to save the JSON file
        """
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            logger.info(f"Successfully saved output to {output_path}")
        except Exception as e:
            logger.error(f"Error saving output to {output_path}: {str(e)}")
            raise 