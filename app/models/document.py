from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum

class DocumentType(str, enum.Enum):
    HEALTH_CERTIFICATE = "보건증"
    EMPLOYMENT_CONTRACT = "근로계약서"

class Document(Base):
    __tablename__ = "erp_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("erp_employees.id"), nullable=False, index=True)
    document_type = Column(SQLEnum(DocumentType, native_enum=False), nullable=False, name="type")  # 보건증/근로계약서
    file_url = Column(String(500), nullable=False)  # 파일 경로 (Supabase Storage 또는 로컬)
    issue_date = Column(Date, nullable=True)  # 발급일
    expiry_date = Column(Date, nullable=True)  # 만료일 (보건증 등)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    employee = relationship("Employee", back_populates="documents")

