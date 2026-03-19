"""
서류 생성 API 엔드포인트
6종 서류를 생성하고 다운로드 또는 미리보기 제공
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from io import BytesIO
from urllib.parse import quote
from app.db.session import get_db
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.utils.document_generator import generate_document, generate_document_html
from datetime import datetime

router = APIRouter()

# 서류 타입 한글명 매핑
DOCUMENT_NAMES = {
    'receipt_of_employment': '재직증명서',
    'career_certificate': '경력증명서',
    'pay_stub': '급여명세서',
    'withholding_receipt': '원천징수영수증',
    'resignation_certificate': '퇴직증명서',
    'severance_settlement': '퇴직금정산서',
}


@router.get("/generate/{employee_id}/{document_type}")
def generate_employee_document(
    employee_id: int,
    document_type: str,
    year_month: Optional[str] = Query(None, description="급여명세서/원천징수영수증용 년월 (YYYY-MM)"),
    preview: bool = Query(False, description="미리보기 모드"),
    db: Session = Depends(get_db)
):
    """직원 서류 생성"""
    # 직원 정보 조회
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    
    # 서류 타입 확인
    if document_type not in DOCUMENT_NAMES:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 서류 타입입니다: {document_type}")
    
    # 직원 데이터 준비
    # Position Enum은 str을 상속받으므로 value를 사용하면 한글 값이 반환됨
    if hasattr(employee.employee_position, 'value'):
        position_value = employee.employee_position.value
    else:
        position_value = str(employee.employee_position)
    
    # SalaryType Enum도 value 사용
    if hasattr(employee.salary_type, 'value'):
        salary_type_value = employee.salary_type.value
    else:
        salary_type_value = str(employee.salary_type)
    
    employee_data = {
        'name': employee.name,
        'ssn': employee.ssn or '',
        'birth_date': employee.birth_date.strftime('%Y-%m-%d') if employee.birth_date else '',
        'address': employee.address or '',
        'employee_position': position_value,
        'salary_type': salary_type_value,
        'hire_date': employee.hire_date.strftime('%Y-%m-%d') if employee.hire_date else '',
        'resign_date': employee.resign_date.strftime('%Y-%m-%d') if employee.resign_date else '',
    }
    
    # 추가 데이터 준비 (급여 관련 서류)
    additional_data = None
    if document_type in ['pay_stub', 'withholding_receipt']:
        if year_month:
            payroll = db.query(Payroll).filter(
                Payroll.employee_id == employee_id,
                Payroll.year_month == year_month
            ).first()
            if payroll:
                additional_data = {
                    'year_month': payroll.year_month,
                    'base_pay': float(payroll.base_pay),
                    'deductions': float(payroll.deductions),
                    'net_pay': float(payroll.net_pay),
                }
        else:
            # 최근 급여 데이터 사용
            payroll = db.query(Payroll).filter(
                Payroll.employee_id == employee_id
            ).order_by(Payroll.year_month.desc()).first()
            if payroll:
                additional_data = {
                    'year_month': payroll.year_month,
                    'base_pay': float(payroll.base_pay),
                    'deductions': float(payroll.deductions),
                    'net_pay': float(payroll.net_pay),
                }
    
    try:
        if preview:
            # 미리보기 모드: HTML 형식으로 서류 생성
            html_content = generate_document_html(document_type, employee_data, additional_data)
            return HTMLResponse(content=html_content)
        else:
            # 다운로드 모드: DOCX 형식으로 서류 생성
            from app.utils.document_generator import generate_document
            doc = generate_document(document_type, employee_data, additional_data)
            
            # 메모리 버퍼에 저장
            buffer = BytesIO()
            doc.save(buffer)
            buffer.seek(0)
            
            # 파일명 생성
            doc_name = DOCUMENT_NAMES.get(document_type, document_type)
            filename = f"{doc_name}_{employee.name}_{datetime.now().strftime('%Y%m%d')}.docx"
            
            # 파일명을 URL 인코딩 (한글 처리)
            encoded_filename = quote(filename, safe='')
            content_disposition_value = f'attachment; filename*=UTF-8\'\'{encoded_filename}'
            
            # 버퍼 내용 읽기
            file_content = buffer.read()
            
            return Response(
                content=file_content,
                media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                headers={
                    'Content-Disposition': content_disposition_value,
                }
            )
    
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"서류 생성 오류: {str(e)}")
        print(f"오류 상세: {error_detail}")
        raise HTTPException(status_code=500, detail=f"서류 생성 중 오류 발생: {str(e)}")


@router.get("/document-types")
def get_document_types():
    """사용 가능한 서류 타입 목록 조회"""
    return {
        'document_types': [
            {'type': k, 'name': v} for k, v in DOCUMENT_NAMES.items()
        ]
    }

