import pypdf
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class PDFParser:
    
    @staticmethod
    async def extract_text_from_pdf(file_path: str) -> Optional[str]:
        
        try:
            text = ""
            with open(file_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                
                # Extract text from all pages
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text += page.extract_text() + "\n"
            
            if not text.strip():
                logger.warning(f"No text extracted from {file_path}")
                return None
                
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF {file_path}: {str(e)}")
            return None
    
    @staticmethod
    def clean_text(text: str) -> str:
        # Remove extra whitespace
        text = ' '.join(text.split())
        return text
