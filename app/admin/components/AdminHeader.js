'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, User, ChevronDown } from 'lucide-react';

export default function AdminHeader({ user }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'flex-end', 
      padding: '16px 32px', 
      background: 'transparent',
      marginBottom: '-32px', // Pull content up slightly
      position: 'relative',
      zIndex: 10
    }}>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '8px 16px', 
            background: 'white', 
            borderRadius: '40px', 
            border: '1px solid var(--border)', 
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, #059669 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {user?.email?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', maxWidth: '120px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.email}</span>
          </div>
          <ChevronDown size={16} color="var(--text-muted)" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </button>

        {dropdownOpen && (
          <div style={{ 
            position: 'absolute', 
            top: 'calc(100% + 8px)', 
            right: 0, 
            background: 'white', 
            borderRadius: '16px', 
            boxShadow: 'var(--shadow-lg)', 
            border: '1px solid var(--border)',
            minWidth: '200px',
            padding: '8px',
            animation: 'slideDown 0.2s ease-out'
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Signed in as</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>{user?.email}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>Administrator</div>
            </div>
            
            <form action="/api/admin/auth/logout" method="POST">
              <button type="submit" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '10px 12px', 
                width: '100%', 
                background: 'transparent', 
                color: '#ef4444', 
                fontWeight: 500, 
                borderRadius: '8px', 
                cursor: 'pointer', 
                border: 'none', 
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={16} /> 退出登录
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
