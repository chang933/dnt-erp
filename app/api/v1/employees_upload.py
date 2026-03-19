from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.employee import Employee
from app.models.document import DocumentType
from app.schemas.document import DocumentCreate
from app.crud import document as crud_document
import os
import uuid
from datetime import datetime

router = APIRouter()

# 파일 업로드 디렉토리
UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/{employee_id}/health-certificate")
async def upload_health_certificate(
    employee_id: int,
    file: UploadFile = File(..., description="보건증 이미지 파일"),
    issue_date: str = Form(None, description="발급일 (YYYY-MM-DD)"),
    expiry_date: str = Form(None, description="만료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """직원 보건증 업로드"""
    # 직원 존재 여부 확인
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    
    # 파일 저장
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    unique_filename = f"{employee_id}_health_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 상대 경로로 저장
        file_url = f"/uploads/documents/{unique_filename}"
        
        # 날짜 파싱
        from datetime import date
        parsed_issue_date = None
        parsed_expiry_date = None
        if issue_date:
            parsed_issue_date = datetime.strptime(issue_date, "%Y-%m-%d").date()
        if expiry_date:
            parsed_expiry_date = datetime.strptime(expiry_date, "%Y-%m-%d").date()
        
        # 서류 생성
        document = DocumentCreate(
            employee_id=employee_id,
            document_type=DocumentType.HEALTH_CERTIFICATE,
            file_url=file_url,
            issue_date=parsed_issue_date,
            expiry_date=parsed_expiry_date
        )
        
        return crud_document.create_document(db=db, document=document)
    except Exception as e:
        # 오류 발생 시 업로드된 파일 삭제
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류 발생: {str(e)}")


@router.post("/{employee_id}/employment-contract")
async def upload_employment_contract(
    employee_id: int,
    file: UploadFile = File(..., description="근로계약서 이미지 파일"),
    issue_date: str = Form(None, description="계약일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """직원 근로계약서 업로드"""
    # 직원 존재 여부 확인
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    
    # 파일 저장
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    unique_filename = f"{employee_id}_contract_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 상대 경로로 저장
        file_url = f"/uploads/documents/{unique_filename}"
        
        # 날짜 파싱
        from datetime import date
        parsed_issue_date = None
        if issue_date:
            parsed_issue_date = datetime.strptime(issue_date, "%Y-%m-%d").date()
        
        # 서류 생성
        document = DocumentCreate(
            employee_id=employee_id,
            document_type=DocumentType.EMPLOYMENT_CONTRACT,
            file_url=file_url,
            issue_date=parsed_issue_date,
            expiry_date=None
        )
        
        return crud_document.create_document(db=db, document=document)
    except Exception as e:
        # 오류 발생 시 업로드된 파일 삭제
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류 발생: {str(e)}")

