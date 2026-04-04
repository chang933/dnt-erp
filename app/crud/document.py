from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.models.document import Document, DocumentType
from app.schemas.document import DocumentCreate, DocumentUpdate


def get_document(db: Session, document_id: int, store_id: int) -> Optional[Document]:
    """서류 ID로 조회"""
    return (
        db.query(Document)
        .filter(Document.id == document_id, Document.store_id == store_id)
        .first()
    )


def get_documents_by_employee(
    db: Session,
    store_id: int,
    employee_id: int,
    document_type: Optional[DocumentType] = None,
) -> List[Document]:
    """직원의 서류 목록 조회"""
    query = db.query(Document).filter(
        Document.store_id == store_id, Document.employee_id == employee_id
    )

    if document_type:
        query = query.filter(Document.document_type == document_type)

    return query.order_by(Document.created_at.desc()).all()


def get_expiring_documents(db: Session, store_id: int, days: int = 30) -> List[Document]:
    """만료 예정 서류 조회 (기본 30일 이내)"""
    expiry_threshold = date.today() + timedelta(days=days)

    return (
        db.query(Document)
        .filter(
            Document.store_id == store_id,
            and_(
                Document.expiry_date.isnot(None),
                Document.expiry_date <= expiry_threshold,
                Document.expiry_date >= date.today(),
            ),
        )
        .order_by(Document.expiry_date)
        .all()
    )


def get_expired_documents(db: Session, store_id: int) -> List[Document]:
    """만료된 서류 조회"""
    return (
        db.query(Document)
        .filter(
            Document.store_id == store_id,
            and_(
                Document.expiry_date.isnot(None),
                Document.expiry_date < date.today(),
            ),
        )
        .order_by(Document.expiry_date)
        .all()
    )


def create_document(db: Session, store_id: int, document: DocumentCreate) -> Document:
    """새 서류 생성"""
    db_document = Document(
        store_id=store_id,
        employee_id=document.employee_id,
        document_type=document.document_type,
        file_url=document.file_url,
        issue_date=document.issue_date,
        expiry_date=document.expiry_date,
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


def update_document(
    db: Session, store_id: int, document_id: int, document_update: DocumentUpdate
) -> Optional[Document]:
    """서류 수정"""
    db_document = get_document(db, document_id, store_id)
    if not db_document:
        return None

    update_data = document_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_document, field, value)

    db.commit()
    db.refresh(db_document)
    return db_document


def delete_document(db: Session, store_id: int, document_id: int) -> bool:
    """서류 삭제"""
    db_document = get_document(db, document_id, store_id)
    if not db_document:
        return False

    db.delete(db_document)
    db.commit()
    return True
