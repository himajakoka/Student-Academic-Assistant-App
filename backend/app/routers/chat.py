import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.chat import ChatConversation, ChatMessage
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatConversationCreate,
    ChatConversationResponse,
    ChatConversationDetailResponse,
    SourceReference,
)
from app.services.rag_service import retrieve_authorized_context
from app.services.ai_service import ask_ai
from app.routers.deps import get_current_user

router = APIRouter(prefix="/chat", tags=["AI Academic Assistant"])

def parse_sources(sources_json: Optional[str]) -> Optional[List[SourceReference]]:
    if not sources_json:
        return None
    try:
        data = json.loads(sources_json)
        return [SourceReference(**item) for item in data]
    except Exception:
        return None

def build_message_response(msg: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        sources=parse_sources(msg.sources),
        is_demo=msg.is_demo,
        created_at=msg.created_at
    )

@router.get("/conversations", response_model=List[ChatConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    convs = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == current_user.id)
        .order_by(ChatConversation.updated_at.desc())
        .all()
    )
    results = []
    for c in convs:
        count = db.query(ChatMessage).filter(ChatMessage.conversation_id == c.id).count()
        results.append(ChatConversationResponse(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=count
        ))
    return results

@router.post("/conversations", response_model=ChatConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: ChatConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = ChatConversation(
        user_id=current_user.id,
        title=conv_in.title or "Academic Consultation"
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ChatConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0
    )

@router.get("/conversations/{conversation_id}", response_model=ChatConversationDetailResponse)
def get_conversation_detail(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return ChatConversationDetailResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(messages),
        messages=[build_message_response(m) for m in messages]
    )

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    db.delete(conv)
    db.commit()
    return None

@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(
    chat_in: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Resolve or create conversation
    conv = None
    if chat_in.conversation_id:
        conv = db.query(ChatConversation).filter(
            ChatConversation.id == chat_in.conversation_id,
            ChatConversation.user_id == current_user.id
        ).first()

    if not conv:
        # Create new conversation with title derived from first message
        first_title = chat_in.message.strip()[:40] + ("..." if len(chat_in.message) > 40 else "")
        conv = ChatConversation(
            user_id=current_user.id,
            title=first_title or "Academic Consultation"
        )
        db.add(conv)
        db.flush()

    # 2. Save user message
    user_msg = ChatMessage(
        conversation_id=conv.id,
        user_id=current_user.id,
        role="user",
        content=chat_in.message,
        is_demo=False
    )
    db.add(user_msg)
    db.flush()

    # 3. RAG Retrieval strictly scoped to current_user.id
    context_str, sources = retrieve_authorized_context(
        query=chat_in.message,
        user_id=current_user.id,
        db=db
    )

    # 4. Fetch previous conversation messages for memory
    past_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(8)
        .all()
    )
    history_payload = [{"role": m.role, "content": m.content} for m in past_messages]

    # 5. Generate response (LLM or fallback demo)
    ai_text, is_demo = await ask_ai(
        query=chat_in.message,
        context=context_str,
        sources=sources,
        conversation_history=history_payload
    )

    # 6. Save assistant message with sources
    sources_json = json.dumps([s.model_dump() for s in sources]) if sources else None
    asst_msg = ChatMessage(
        conversation_id=conv.id,
        user_id=current_user.id,
        role="assistant",
        content=ai_text,
        sources=sources_json,
        is_demo=is_demo
    )
    db.add(asst_msg)

    # Update conversation timestamp
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(asst_msg)

    return build_message_response(asst_msg)
