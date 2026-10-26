import os
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.models.subject import Subject
from app.schemas.document import DocumentResponse, DocumentDetailResponse, DocumentSearchResult
from app.services.document_parser import extract_text_from_file, chunk_text
from app.services.rag_service import tokenize, calculate_relevance_score
from app.routers.deps import get_current_user

router = APIRouter(prefix="/documents", tags=["Document Vault"])

def build_doc_response(doc: Document) -> DocumentResponse:
    subj = doc.subject
    return DocumentResponse(
        id=doc.id,
        user_id=doc.user_id,
        subject_id=doc.subject_id,
        subject_name=subj.name if subj else None,
        title=doc.title,
        category=doc.category,
        original_filename=doc.original_filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        has_extracted_text=bool(doc.extracted_text and len(doc.extracted_text.strip()) > 0),
        created_at=doc.created_at
    )

@router.get("", response_model=List[DocumentResponse])
def get_documents(
    category: Optional[str] = None,
    subject_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Document).filter(Document.user_id == current_user.id)
    if category:
        query = query.filter(Document.category == category.lower())
    if subject_id:
        query = query.filter(Document.subject_id == subject_id)
    docs = query.order_by(Document.created_at.desc()).all()
    return [build_doc_response(d) for d in docs]

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("study_material"),
    subject_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate extension
    orig_name = file.filename or "uploaded_file"
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{ext}' not allowed. Permitted types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Read and validate size
    contents = await file.read()
    file_size = len(contents)
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB."
        )
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Cannot upload an empty file.")

    # Validate subject if provided
    if subject_id:
        subj = db.query(Subject).filter(Subject.id == subject_id, Subject.user_id == current_user.id).first()
        if not subj:
            raise HTTPException(status_code=400, detail="Invalid subject ID.")

    # Generate safe unique filename to prevent path traversal
    safe_filename = f"user_{current_user.id}_{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    with open(dest_path, "wb") as f:
        f.write(contents)

    # Extract text from supported formats
    extracted_text = extract_text_from_file(dest_path, ext)

    doc = Document(
        user_id=current_user.id,
        subject_id=subject_id,
        title=title.strip(),
        category=category.lower(),
        original_filename=orig_name,
        stored_filename=safe_filename,
        file_type=ext.replace(".", "").upper(),
        file_size=file_size,
        extracted_text=extracted_text,
        indexed_at=datetime.now(timezone.utc)
    )
    db.add(doc)
    db.flush()

    # Index chunks for search & RAG
    chunks = chunk_text(extracted_text)
    for idx, c_text in enumerate(chunks):
        chunk_obj = DocumentChunk(
            document_id=doc.id,
            user_id=current_user.id,
            chunk_index=idx,
            chunk_text=c_text
        )
        db.add(chunk_obj)

    db.commit()
    db.refresh(doc)
    return build_doc_response(doc)

@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document_details(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")

    base_resp = build_doc_response(doc)
    snippet = doc.extracted_text[:1000] if doc.extracted_text else ""
    return DocumentDetailResponse(
        **base_resp.model_dump(),
        extracted_text_snippet=snippet
    )

@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")

    file_path = os.path.join(settings.UPLOAD_DIR, doc.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical document file missing on server.")

    return FileResponse(
        path=file_path,
        filename=doc.original_filename,
        media_type="application/octet-stream"
    )

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove physical file
    file_path = os.path.join(settings.UPLOAD_DIR, doc.stored_filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return None
