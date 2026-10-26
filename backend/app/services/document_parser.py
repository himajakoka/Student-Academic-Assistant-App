import os
from typing import List, Tuple
from pypdf import PdfReader

def extract_text_from_file(file_path: str, file_type: str) -> str:
    """Extract readable text from PDF, TXT, or MD file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError("Uploaded file was not found on server disk.")

    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".pdf":
        try:
            reader = PdfReader(file_path)
            extracted_pages = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    extracted_pages.append(f"--- Page {i + 1} ---\n" + text.strip())
            return "\n\n".join(extracted_pages).strip()
        except Exception as e:
            return f"Note: PDF text extraction could not complete: {str(e)}"

    elif ext in [".txt", ".md"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()
        except Exception as e:
            return f"Note: Text read error: {str(e)}"

    elif ext in [".png", ".jpg", ".jpeg"]:
        # Images without OCR engine configured
        return f"[Image Document: {os.path.basename(file_path)} - OCR engine is not active in current local profile.]"

    return ""

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 80) -> List[str]:
    """Split text into overlapping chunks for semantic or keyword retrieval."""
    if not text or len(text.strip()) == 0:
        return []

    clean_text = " ".join(text.split())
    chunks = []
    start = 0
    while start < len(clean_text):
        end = start + chunk_size
        chunk = clean_text[start:end]
        if chunk:
            chunks.append(chunk)
        start += (chunk_size - overlap)
    return chunks
