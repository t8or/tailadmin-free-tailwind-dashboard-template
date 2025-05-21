import os
import json
import logging
import pandas as pd
from typing import Dict, Any, List, Optional
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('csv_processor')

class CSVProcessor:
    def __init__(self):
        pass

    def _convert_value(self, value: Any) -> Any:
        """
        Convert numpy and pandas data types to Python native types for JSON serialization.
        
        Args:
            value: The value to convert
            
        Returns:
            The converted value
        """
        if isinstance(value, (np.integer, np.floating)):
            return value.item()
        elif isinstance(value, np.ndarray):
            return value.tolist()
        elif pd.isna(value):
            return None
        return value

    def process_csv(self, csv_path: str) -> Dict[str, Any]:
        """
        Process a CSV file and return structured JSON output.
        
        Args:
            csv_path (str): Path to the CSV file
            
        Returns:
            Dict[str, Any]: Structured data containing CSV content and metadata
        """
        try:
            # Read CSV file
            df = pd.read_csv(csv_path)
            
            # Get basic metadata
            metadata = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": list(df.columns),
                "file_name": os.path.basename(csv_path),
                "file_size": os.path.getsize(csv_path)
            }
            
            # Get column statistics
            column_stats = {}
            for column in df.columns:
                stats = {
                    "dtype": str(df[column].dtype),
                    "null_count": df[column].isnull().sum(),
                    "unique_values": len(df[column].unique())
                }
                
                # Add numeric statistics if applicable
                if pd.api.types.is_numeric_dtype(df[column]):
                    stats.update({
                        "min": self._convert_value(df[column].min()),
                        "max": self._convert_value(df[column].max()),
                        "mean": self._convert_value(df[column].mean()),
                        "median": self._convert_value(df[column].median())
                    })
                
                column_stats[column] = stats
            
            # Convert DataFrame to list of dictionaries
            data = []
            for _, row in df.iterrows():
                row_dict = {}
                for column in df.columns:
                    row_dict[column] = self._convert_value(row[column])
                data.append(row_dict)
            
            # Structure the output
            result = {
                "metadata": metadata,
                "column_statistics": column_stats,
                "data": data,
                "processing_status": "success"
            }
            
            logger.info(f"Successfully processed CSV: {csv_path}")
            return result
            
        except Exception as e:
            error_msg = f"Error processing CSV {csv_path}: {str(e)}"
            logger.error(error_msg)
            return {
                "processing_status": "error",
                "error_message": error_msg,
                "metadata": {},
                "column_statistics": {},
                "data": []
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