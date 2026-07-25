import React, { useState, useEffect } from 'react';
import { subscribeAnnouncements } from '../services/announcementService';

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const unsub = subscribeAnnouncements((list) => {
      setAnnouncements(list.filter(a => a.active !== false));
    });
    return () => unsub();
  }, []);

  if (announcements.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {announcements.map((item) => {
        const isUrgent = item.priority === 'URGENT';

        return (
          <div 
            key={item.id} 
            className="glass-panel" 
            style={{
              padding: '1rem 1.2rem',
              borderLeft: isUrgent ? '4px solid var(--danger)' : '4px solid var(--accent-primary)',
              background: isUrgent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>{item.title}</strong>
              <span style={{ 
                fontSize: '0.7rem', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontWeight: 'bold',
                background: isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: isUrgent ? 'var(--danger)' : 'var(--accent-primary)',
                border: isUrgent ? '1px solid var(--danger)' : '1px solid var(--accent-primary)'
              }}>
                {isUrgent ? 'AVISO URGENTE' : 'COMUNICADO OFICIAL'}
              </span>
            </div>

            {item.content && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                {item.content}
              </p>
            )}

            <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', textAlign: 'right' }}>
              Publicado por {item.createdBy || 'Directiva'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
