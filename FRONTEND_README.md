# 프론트엔드 실행 가이드

## 문제 해결

### "데이터를 불러오는 중..." 메시지가 계속 표시되는 경우

1. **백엔드 서버 확인**
   - 백엔드 서버가 실행 중인지 확인: http://localhost:8000/docs
   - 실행 중이 아니라면:
     ```bash
     cd dnt-erp
     venv\Scripts\activate
     set PYTHONPATH=.
     python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
     ```

2. **브라우저 콘솔 확인**
   - F12 키를 눌러 개발자 도구 열기
   - Console 탭에서 에러 메시지 확인
   - Network 탭에서 API 요청이 실패하는지 확인

3. **프론트엔드 재시작**
   ```bash
   cd frontend
   npm start
   ```

## 접속 주소

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

