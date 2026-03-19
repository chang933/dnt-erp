# 데이터베이스 연결 설정 가이드

## Supabase(DB) 연결 실패 시 나타나는 현상

**네, Supabase에서 DB를 못 받아와도 지금처럼 될 수 있습니다.**

1. **API 요청** (예: 직원 목록 `GET /api/v1/employees/`) → 백엔드가 DB(Supabase)에 쿼리 시도
2. **DB 연결 실패** (비밀번호/호스트 오류, 네트워크, Supabase 중단 등) → `psycopg2.OperationalError` 발생
3. **백엔드가 500 Internal Server Error 반환**
4. **500 응답에 CORS 헤더가 없으면** → 브라우저가 "CORS policy: No 'Access-Control-Allow-Origin' header" 로 **차단**
5. **프론트에서는** → "Network Error", "ERR_NETWORK" 로만 보임

즉, **DB를 못 받아오면 500이 나고, 500에 CORS가 없으면 CORS 에러처럼 보입니다.**  
지금은 예외 핸들러에서 500에도 CORS를 붙였으므로, DB가 실패해도 브라우저는 응답을 받을 수 있고 "Internal server error" 등으로 확인할 수 있습니다.

### DB 연결 상태 확인

- 브라우저에서 **http://localhost:8000/health/db** 접속
  - `{"status":"ok","database":"connected"}` → DB 연결 정상
  - 500 또는 에러 메시지 → `DATABASE_URL`(비밀번호, 호스트) 및 Supabase 프로젝트 상태 확인

---

## yamasyeo 프로젝트 연결 정보 확인 방법

1. Supabase 대시보드 접속: https://supabase.com/dashboard
2. `yamasyeo` 프로젝트 선택
3. Settings > Database 메뉴로 이동
4. Connection string 섹션에서 다음 정보 확인:
   - Host
   - Database name
   - Port
   - User
   - Password

## 연결 정보 형식

일반적인 Supabase 연결 형식:
```
postgresql+psycopg2://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
```

예시:
```
postgresql+psycopg2://postgres:your_password@db.xxxxx.supabase.co:5432/postgres
```

## .env 파일 생성

프로젝트 루트에 `.env` 파일을 생성하고 다음과 같이 설정:

```env
DATABASE_URL=postgresql+psycopg2://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
SECRET_KEY=your-secret-key
ENVIRONMENT=development
```

