import React, { useState, useEffect } from 'react';
import { subscribeCleaningHistory } from '../services/cleaningHistoryService';

export default function CleaningHistoryModal({ isOpen, onClose }) {
  const [historyList, setHistoryList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeCleaningHistory((list) => {
      setHistoryList(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredHistory = historyList.filter(item => {
    const term = searchTerm.toLowerCase();
    const nameMatch = (item.memberName || '').toLowerCase().includes(term);
    const rangeMatch = (item.weekRange || '').toLowerCase().includes(term);
    const completedByMatch = (item.completedByName || '').toLowerCase().includes(term);
    return nameMatch || rangeMatch || completedByMatch;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Reciente';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '640px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Histórico de Limpiezas</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Registro cronológico de turnos completados por los socios
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.4rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Buscador */}
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="text"
            className="form-input"
            placeholder="Buscar por socio o semana..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem 0.8rem' }}
          />
        </div>

        {/* Lista del Histórico */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem' }}>
              Cargando historial...
            </p>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                  <path d="m5 2 5 5"/>
                  <path d="M2 13h10"/>
                  <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                </svg>
              </div>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                {searchTerm ? 'No se encontraron limpiezas para esa búsqueda.' : 'Aún no hay limpiezas registradas en el histórico.'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div 
                key={item.id} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '6px', 
                  padding: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.8rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>
                      {item.memberName}
                    </strong>
                    {item.isManual ? (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        Socio Manual
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', background: '#064e3b', color: '#34d399', border: '1px solid #10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        Socio
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>Semana: {item.weekRange}</span>
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#a1a1aa', marginTop: '2px' }}>
                    Validado por: <span style={{ color: '#e4e4e7' }}>{item.completedByName}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>
                    ✓ Completado
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {formatDate(item.completedAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie de modal */}
        <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }}>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
