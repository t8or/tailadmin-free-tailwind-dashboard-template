import os
import json
import logging
from PIL import Image
import pytesseract
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('image_processor')

class ImageProcessor:
    def __init__(self):
        # Configure Tesseract path if needed
        if os.path.exists('/usr/local/bin/tesseract'):
            pytesseract.pytesseract.tesseract_cmd = '/usr/local/bin/tesseract'
        elif os.path.exists('/usr/bin/tesseract'):
            pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

    def process_image(self, image_path: str) -> Dict[str, Any]:
        """
        Process an image file using Tesseract OCR and return structured JSON output.
        
        Args:
            image_path (str): Path to the image file
            
        Returns:
            Dict[str, Any]: Structured data containing OCR results and metadata
        """
        try:
            # Open and process the image
            with Image.open(image_path) as img:
                # Get image metadata
                metadata = {
                    "format": img.format,
                    "size": img.size,
                    "mode": img.mode
                }
                
                # Perform OCR
                ocr_text = pytesseract.image_to_string(img)
                
                # Get confidence scores
                ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                
                # Calculate average confidence
                confidences = [conf for conf in ocr_data['conf'] if conf != -1]
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                
                # Structure the output
                result = {
                    "metadata": metadata,
                    "extracted_text": ocr_text.strip(),
                    "confidence_score": round(avg_confidence, 2),
                    "processing_status": "success"
                }
                
                # Log success
                logger.info(f"Successfully processed image: {image_path}")
                return result
                
        except Exception as e:
            error_msg = f"Error processing image {image_path}: {str(e)}"
            logger.error(error_msg)
            return {
                "processing_status": "error",
                "error_message": error_msg,
                "extracted_text": "",
                "confidence_score": 0
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