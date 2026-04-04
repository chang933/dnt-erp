# D.N.T ERP

식당 관리 ERP 시스템

## 기능

### 1. 직원 관리
- 직원 등록 (이름, 연락처, 주소, 생년월일, 포지션, 시급, 입사일)
- 직원 목록 조회
- 직원 정보 수정
- 퇴사 처리

### 2. 스케줄 관리
- 월간 캘린더 뷰
- 출근/휴무 배치
- 홀/주방 구분 표시
- 드래그 앤 드롭으로 일정 배치 (프론트엔드)

### 3. 출퇴근 기록
- 일별 출퇴근 시간 입력 (사장/매니저 수기 입력)
- 지각/조퇴/결근 표시
- 월간 근무시간 합계

### 4. 급여 관리
- 근무시간 기반 자동 계산
- 주휴수당 계산
- 공제항목 (4대보험 등)
- 월별 급여명세서

### 5. 서류 관리
- 보건증 업로드 및 만료일 알림
- 근로계약서 업로드 및 보관
- 재직증명서 출력 (PDF)

### 6. 식자재 관리
- 재료 등록 (품목, 단가, 단위)
- 입고/출고 기록
- 재고 현황

### 7. 수익 관리
- 마진율 계산기 (매출, 임대료, 인건비 등 입력 → 자동 계산)
- 월별 손익 리포트

### 8. 고객 관리
- 고객 등록 (연락처, 메모, 방문기록)
- VIP 관리
- 블랙리스트 관리 (사유, 날짜)

## 기술 스택

- **Backend**: FastAPI
- **Database**: PostgreSQL (Supabase)
- **ORM**: SQLAlchemy
- **Python**: 3.10+

## 설치 및 실행

### 1. 가상환경 생성 및 활성화

```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

`.env` 파일을 생성하고 `.env.example`을 참고해 값을 넣습니다. (DB 비밀번호·SECRET_KEY는 저장소에 올리지 마세요.)

```env
DATABASE_URL=postgresql+psycopg2://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SECRET_KEY=your-secret-key
ENVIRONMENT=development
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=your-initial-password
```

### 4. 테이블 생성

```bash
python create_tables.py
```

### 5. 서버 실행

```bash
cd dnt-erp
set PYTHONPATH=.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

또는:

```bash
python -m uvicorn app.main:app --reload
```

서버는 `http://localhost:8000`에서 실행됩니다.

API 문서는 `http://localhost:8000/docs`에서 확인할 수 있습니다.

## 배포 (GitHub + Render API + Vercel 프론트)

### 1) GitHub

```bash
git add -A
git commit -m "feat: multi-store, auth, admin stores, deploy config"
git push origin main
```

### 2) 백엔드 API — Render

1. [Render](https://render.com) → **New** → **Blueprint** → 이 저장소 연결 후 `render.yaml` 적용  
   또는 **Web Service**로 Python 앱 추가 (Root: 저장소 루트).
2. **Build**: `pip install -r requirements.txt`  
   **Start**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. **Environment**에 설정:
   - `DATABASE_URL` — Supabase 연결 문자열
   - `SECRET_KEY` — 긴 랜덤 문자열
   - `ENVIRONMENT` — `production`
   - `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` — 최초 어드민(선택)
   - `CORS_ORIGINS` — 프론트 URL(예: `https://xxx.vercel.app`) — 쉼표로 여러 개 가능
4. 배포 URL이 나오면(예: `https://dnt-erp.onrender.com`) 헬스 확인: `GET /health`
5. **로그인 404 시**: Render가 예전 커밋을 서빙 중입니다. 대시보드에서 **Manual Deploy → Deploy latest commit** 으로 최신 `main`을 올리세요. 배포 후 브라우저에서 `https://(서비스URL)/openapi.json` 을 열어 `"\/api\/v1\/auth\/login"` 경로가 있는지 확인합니다.

### 3) 프론트엔드 — Vercel

1. [Vercel](https://vercel.com) → **Add New Project** → 같은 GitHub 저장소 선택  
2. **Root Directory**를 `frontend`로 지정  
3. **Environment Variables**: `REACT_APP_API_BASE_URL` = Render API URL (예: `https://dnt-erp-api.onrender.com`, 끝에 `/api` 없음)  
4. 배포 후 Render 쪽 `CORS_ORIGINS`에 Vercel 도메인을 추가하고 API를 재배포

### Docker (선택)

```bash
docker build -t dnt-erp-api .
docker run -e DATABASE_URL=... -e SECRET_KEY=... -e PORT=8000 -p 8000:8000 dnt-erp-api
```

## 프로젝트 구조

```
dnt-erp/
├── app/
│   ├── api/           # API 엔드포인트
│   │   └── v1/
│   ├── core/          # 설정 파일
│   ├── crud/          # CRUD 작업
│   ├── db/            # 데이터베이스 설정
│   ├── models/        # SQLAlchemy 모델
│   ├── schemas/       # Pydantic 스키마
│   └── utils/         # 유틸리티 함수
├── create_tables.py   # 테이블 생성 스크립트
├── requirements.txt   # Python 의존성
└── README.md
```

## 데이터베이스 테이블

- `erp_employees` - 직원 정보
- `erp_schedules` - 스케줄
- `erp_attendance` - 출퇴근 기록
- `erp_payroll` - 급여
- `erp_documents` - 서류 (보건증, 근로계약서)
- `erp_ingredients` - 식자재
- `erp_inventory_log` - 입출고 기록
- `erp_customers` - 고객
- `erp_visits` - 방문기록

## 개발 계획

1. ✅ 프로젝트 구조 설정
2. ✅ 데이터베이스 모델 정의
3. ⏳ 직원 관리 API
4. ⏳ 스케줄 관리 API
5. ⏳ 출퇴근 기록 API
6. ⏳ 급여 관리 API
7. ⏳ 서류 관리 API
8. ⏳ 식자재 관리 API
9. ⏳ 고객 관리 API
10. ⏳ 마진율 계산기 API

