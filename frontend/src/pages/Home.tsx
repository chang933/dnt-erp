import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const menuItems = [
    { path: '/employees', label: '직원 관리', desc: '직원 등록 및 관리' },
    { path: '/schedules', label: '스케줄 관리', desc: '월간 스케줄 캘린더' },
    { path: '/attendance', label: '출퇴근 관리', desc: '출퇴근 기록 조회' },
    { path: '/payroll', label: '급여 관리', desc: '급여 명세 조회' },
    { path: '/documents', label: '서류 관리', desc: '보건증, 근로계약서 관리' },
    { path: '/ingredients', label: '식자재 관리', desc: '식자재 재고 관리' },
    { path: '/customers', label: '고객 관리', desc: '고객 정보 및 블랙리스트' },
    { path: '/reservations', label: '예약', desc: '예약일·예약자·인원·기타내용 관리' },
  ];

  return (
    <div>
      <div className="card">
        <h2 className="card-title">D.N.T ERP 시스템</h2>
        <p>식당 관리를 위한 종합 ERP 시스템입니다.</p>
      </div>

      <div className="grid grid-2" style={{ marginTop: '1.5rem' }}>
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className="card"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <h3 style={{ marginBottom: '0.5rem', color: '#2c3e50' }}>{item.label}</h3>
            <p style={{ color: '#7f8c8d', fontSize: '0.875rem', margin: 0 }}>{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;

