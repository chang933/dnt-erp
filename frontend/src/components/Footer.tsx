import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-company">D.N.T</div>
        <div className="footer-info">
          <span>대표: 이천화</span>
          <span className="footer-separator">|</span>
          <span>사업자 번호: 304-52-01195</span>
          <span className="footer-separator">|</span>
          <span>고양시 일산동구 무궁화로 20-18, 508-57호(장항동, 하임빌로 데오빌딩)</span>
          <span className="footer-separator">|</span>
          <span>업태: 정보통신업 | 종목: 소프트웨어 공급 유지보수</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

