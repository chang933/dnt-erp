from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta, datetime
from app.db.session import get_db
from app.schemas.document import Document, DocumentCreate, DocumentUpdate, DocumentWithEmployee, ExpiringDocument
from app.crud import document as crud_document
from app.models.employee import Employee
from app.models.document import Document as DocumentModel, DocumentType
import os
import uuid

router = APIRouter()

# 파일 업로드 디렉토리 (나중에 Supabase Storage로 변경 가능)
UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/", response_model=Document, status_code=201)
def create_document(
    document: DocumentCreate,
    db: Session = Depends(get_db)
):
    """새 서류 등록"""
    # 직원 존재 여부 확인
    employee = db.query(Employee).filter(Employee.id == document.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    
    return crud_document.create_document(db=db, document=document)


@router.post("/upload", response_model=Document, status_code=201)
async def upload_document(
    employee_id: int = Query(..., description="직원 ID"),
    document_type: DocumentType = Query(..., description="서류 종류"),
    issue_date: Optional[date] = Query(None, description="발급일"),
    expiry_date: Optional[date] = Query(None, description="만료일"),
    file: UploadFile = File(..., description="업로드할 파일"),
    db: Session = Depends(get_db)
):
    """서류 파일 업로드 및 등록"""
    # 직원 존재 여부 확인
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    
    # 파일 저장
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{employee_id}_{document_type.value}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 상대 경로로 저장 (나중에 URL로 변환 가능)
        file_url = f"/uploads/documents/{unique_filename}"
        
        # 서류 생성
        document = DocumentCreate(
            employee_id=employee_id,
            document_type=document_type,
            file_url=file_url,
            issue_date=issue_date,
            expiry_date=expiry_date
        )
        
        return crud_document.create_document(db=db, document=document)
    except Exception as e:
        # 오류 발생 시 업로드된 파일 삭제
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류 발생: {str(e)}")


@router.get("/", response_model=List[DocumentWithEmployee])
def get_documents(
    employee_id: Optional[int] = Query(None, description="직원 ID로 필터링"),
    document_type: Optional[DocumentType] = Query(None, description="서류 종류로 필터링"),
    db: Session = Depends(get_db)
):
    """서류 목록 조회"""
    if employee_id:
        documents = crud_document.get_documents_by_employee(
            db=db,
            employee_id=employee_id,
            document_type=document_type
        )
    else:
        # 모든 서류 조회
        query = db.query(DocumentModel)
        if document_type:
            query = query.filter(DocumentModel.document_type == document_type)
        documents = query.order_by(DocumentModel.created_at.desc()).limit(1000).all()
    
    # 직원 정보를 포함한 응답 생성
    result = []
    for doc in documents:
        employee = db.query(Employee).filter(Employee.id == doc.employee_id).first()
        if employee:
            result.append(DocumentWithEmployee(
                id=doc.id,
                employee_id=doc.employee_id,
                document_type=doc.document_type,
                file_url=doc.file_url,
                issue_date=doc.issue_date,
                expiry_date=doc.expiry_date,
                created_at=doc.created_at,
                employee_name=employee.name
            ))
    
    return result


@router.get("/expiring", response_model=List[ExpiringDocument])
def get_expiring_documents(
    days: int = Query(30, ge=1, le=365, description="만료 예정 일수"),
    db: Session = Depends(get_db)
):
    """만료 예정 서류 조회 (알림용)"""
    documents = crud_document.get_expiring_documents(db=db, days=days)
    
    # 직원 정보와 만료까지 남은 일수를 포함한 응답 생성
    result = []
    today = date.today()
    for doc in documents:
        employee = db.query(Employee).filter(Employee.id == doc.employee_id).first()
        if employee and doc.expiry_date:
            days_until_expiry = (doc.expiry_date - today).days
            result.append(ExpiringDocument(
                id=doc.id,
                employee_id=doc.employee_id,
                document_type=doc.document_type,
                file_url=doc.file_url,
                issue_date=doc.issue_date,
                expiry_date=doc.expiry_date,
                created_at=doc.created_at,
                employee_name=employee.name,
                days_until_expiry=days_until_expiry
            ))
    
    return result


@router.get("/expired", response_model=List[DocumentWithEmployee])
def get_expired_documents(
    db: Session = Depends(get_db)
):
    """만료된 서류 조회"""
    documents = crud_document.get_expired_documents(db=db)
    
    # 직원 정보를 포함한 응답 생성
    result = []
    for doc in documents:
        employee = db.query(Employee).filter(Employee.id == doc.employee_id).first()
        if employee:
            result.append(DocumentWithEmployee(
                id=doc.id,
                employee_id=doc.employee_id,
                document_type=doc.document_type,
                file_url=doc.file_url,
                issue_date=doc.issue_date,
                expiry_date=doc.expiry_date,
                created_at=doc.created_at,
                employee_name=employee.name
            ))
    
    return result


@router.get("/{document_id}", response_model=Document)
def get_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """서류 상세 조회"""
    db_document = crud_document.get_document(db=db, document_id=document_id)
    if db_document is None:
        raise HTTPException(status_code=404, detail="서류를 찾을 수 없습니다")
    return db_document


@router.put("/{document_id}", response_model=Document)
def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: Session = Depends(get_db)
):
    """서류 수정"""
    db_document = crud_document.update_document(
        db=db,
        document_id=document_id,
        document_update=document_update
    )
    if db_document is None:
        raise HTTPException(status_code=404, detail="서류를 찾을 수 없습니다")
    return db_document


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """서류 삭제"""
    success = crud_document.delete_document(db=db, document_id=document_id)
    if not success:
        raise HTTPException(status_code=404, detail="서류를 찾을 수 없습니다")
    return None

