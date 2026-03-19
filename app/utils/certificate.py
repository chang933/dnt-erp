"""
재직증명서 PDF 생성 유틸리티
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from typing import Optional
from datetime import date
import os


def generate_certificate_of_employment(
    employee_name: str,
    birth_date: Optional[date],
    address: Optional[str],
    hire_date: date,
    position: str,
    company_name: str = "OOO",
    representative_name: str = "OOO",
    output_path: str = "certificate_of_employment.pdf"
) -> str:
    """
    재직증명서 PDF 생성
    
    Args:
        employee_name: 직원 이름
        birth_date: 생년월일
        address: 주소
        hire_date: 입사일
        position: 부서/포지션
        company_name: 회사명
        representative_name: 대표자명
        output_path: 출력 파일 경로
    
    Returns:
        생성된 PDF 파일 경로
    """
    # A4 크기의 PDF 생성
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # 한글 폰트 설정 (시스템에 한글 폰트가 있는 경우)
    # 없으면 기본 폰트 사용
    try:
        # Windows 기본 한글 폰트 경로
        font_paths = [
            "C:/Windows/Fonts/malgun.ttf",  # 맑은 고딕
            "C:/Windows/Fonts/gulim.ttc",   # 굴림
            "C:/Windows/Fonts/batang.ttc",  # 바탕
        ]
        
        font_registered = False
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    pdfmetrics.registerFont(TTFont('Korean', font_path))
                    font_registered = True
                    break
                except:
                    continue
        
        if font_registered:
            c.setFont('Korean', 16)
        else:
            c.setFont('Helvetica-Bold', 16)
    except:
        c.setFont('Helvetica-Bold', 16)
    
    # 제목: 재직증명서
    title = "재   직   증   명   서"
    title_width = c.stringWidth(title)
    c.drawString((width - title_width) / 2, height - 60*mm, title)
    
    # 본문 시작 위치
    y_position = height - 100*mm
    line_height = 30
    
    # 본문 내용
    c.setFont('Helvetica', 12)
    
    text_lines = [
        f"성명: {employee_name}",
    ]
    
    if birth_date:
        text_lines.append(f"생년월일: {birth_date.strftime('%Y년 %m월 %d일')}")
    
    if address:
        text_lines.append(f"주소: {address}")
    
    text_lines.append(f"입사일: {hire_date.strftime('%Y년 %m월 %d일')}")
    text_lines.append(f"부서: {position}")
    text_lines.append("")
    text_lines.append(f"위 사람은 당 업체에 재직 중임을 증명합니다.")
    
    for i, line in enumerate(text_lines):
        c.drawString(50*mm, y_position - (i * line_height), line)
    
    # 날짜 및 서명 부분
    today = date.today()
    date_y = 100*mm
    c.drawString(50*mm, date_y, f"{today.strftime('%Y년 %m월 %d일')}")
    
    # 회사명 및 대표자 서명
    signature_y = 70*mm
    c.drawString(width - 150*mm, signature_y, f"상호: {company_name}")
    c.drawString(width - 150*mm, signature_y - 20, f"대표: {representative_name} (인)")
    
    # 저장
    c.save()
    
    return output_path

