from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
from app.models.document import DocumentType


# 서류 생성 요청 스키마
class DocumentCreate(BaseModel):
    employee_id: int = Field(..., description="직원 ID")
    document_type: DocumentType = Field(..., description="서류 종류 (보건증/근로계약서)")
    file_url: str = Field(..., max_length=500, description="파일 경로 (Supabase Storage 또는 로컬)")
    issue_date: Optional[date] = Field(None, description="발급일")
    expiry_date: Optional[date] = Field(None, description="만료일 (보건증 등)")


# 서류 수정 요청 스키마
class DocumentUpdate(BaseModel):
    document_type: Optional[DocumentType] = Field(None, description="서류 종류")
    file_url: Optional[str] = Field(None, max_length=500, description="파일 경로")
    issue_date: Optional[date] = Field(None, description="발급일")
    expiry_date: Optional[date] = Field(None, description="만료일")


# 서류 응답 스키마
class Document(BaseModel):
    id: int
    employee_id: int
    document_type: DocumentType
    file_url: str
    issue_date: Optional[date]
    expiry_date: Optional[date]
    created_at: datetime

    class Config:
        from_attributes = True


# 서류 응답 (직원 정보 포함)
class DocumentWithEmployee(Document):
    employee_name: str

    class Config:
        from_attributes = True


# 만료 예정 서류 조회용
class ExpiringDocument(Document):
    employee_name: str
    days_until_expiry: Optional[int]  # 만료까지 남은 일수

    class Config:
        from_attributes = True

