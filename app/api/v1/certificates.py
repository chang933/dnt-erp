from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.employee import Employee
from app.utils.certificate import generate_certificate_of_employment
import os
import tempfile

router = APIRouter()


@router.get("/employment/{employee_id}")
def generate_employment_certificate(
    employee_id: int,
    company_name: str = "OOO",
    representative_name: str = "OOO",
    db: Session = Depends(get_db)
):
    """재직증명서 PDF 생성 및 다운로드"""
    # 직원 정보 조회
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    
    # 포지션 값을 문자열로 변환
    position_value = employee.employee_position.value if hasattr(employee.employee_position, 'value') else str(employee.employee_position)
    
    # 임시 파일 생성
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    temp_path = temp_file.name
    temp_file.close()
    
    try:
        # 재직증명서 생성
        generate_certificate_of_employment(
            employee_name=employee.name,
            birth_date=employee.birth_date,
            address=employee.address,
            hire_date=employee.hire_date,
            position=position_value,
            company_name=company_name,
            representative_name=representative_name,
            output_path=temp_path
        )
        
        # 파일명 설정
        filename = f"재직증명서_{employee.name}_{employee.hire_date.strftime('%Y%m%d')}.pdf"
        
        return FileResponse(
            temp_path,
            media_type='application/pdf',
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        # 오류 발생 시 임시 파일 삭제
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"재직증명서 생성 중 오류 발생: {str(e)}")

