import React, { useState, useEffect } from 'react';
import { subscribeCleaningHistory, setWeekCleaningStatusByAdmin } from '../services/cleaningHistoryService';
import { isAdminRole } from '../utils/roleUtils';

export default function CleaningHistoryModal({ isOpen, onClose, user, userRole }) {
  const [historyList, setHistoryList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'COMPLETED', 'NOT_COMPLETED'
  const [loading, setLoading] = useState(true);
  const [updatingWeekId, setUpdatingWeekId] = useState(null);

  const isAdmin = isAdminRole(userRole);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const unsub = subscribeCleaningHistory((list) => {
      setHistoryList(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const completedCount = historyList.filter(i => i.completed).length;
  const notCompletedCount = historyList.filter(i => !i.completed).length;

  const filteredHistory = historyList.filter(item => {
    if (statusFilter === 'COMPLETED' && !item.completed) return false;
    if (statusFilter === 'NOT_COMPLETED' && item.completed) return false;

    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const nameMatch = (item.memberName || '').toLowerCase().includes(term);
    const rangeMatch = (item.weekRange || '').toLowerCase().includes(term);
    const weekIdMatch = (item.weekId || '').toLowerCase().includes(term);
    const completedByMatch = (item.completedByName || '').toLowerCase().includes(term);
    return nameMatch || rangeMatch || weekIdMatch || completedByMatch;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Registrado';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleToggleWeekByAdmin = async (item, targetStatus) => {
    if (!isAdmin || updatingWeekId) return;
    const confirmMsg = targetStatus
      ? `¿Marcar como REALIZADA la limpieza de "${item.memberName}" en la semana (${item.weekRange})?`
      : `¿Desmarcar la limpieza de "${item.memberName}" en la semana (${item.weekRange}) y pasarla a NO realizada?`;

    if (!window.confirm(confirmMsg)) return;

    setUpdatingWeekId(item.weekId);
    try {
      await setWeekCleaningStatusByAdmin({
        weekId: item.weekId,
        weekRange: item.weekRange,
        memberId: item.memberId,
        memberName: item.memberName,
        isManual: item.isManual,
        adminUser: user,
        completed: targetStatus
      });
    } catch (err) {
      console.error('Error al cambiar estado de semana desde histórico:', err);
      alert('Error al actualizar la semana: ' + err.message);
    } finally {
      setUpdatingWeekId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '680px', width: '94%', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>
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
              Registro cronológico completo de turnos realizados y no realizados
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Filtros de Estado y Buscador */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              style={{
                flex: 1,
                minWidth: '95px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: statusFilter === 'ALL' ? '700' : '500',
                background: statusFilter === 'ALL' ? '#ffffff' : 'rgba(255,255,255,0.05)',
                color: statusFilter === 'ALL' ? '#000000' : 'var(--text-secondary)',
                border: statusFilter === 'ALL' ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.1)'
              }}
            >
              Todas ({historyList.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('COMPLETED')}
              style={{
                flex: 1,
                minWidth: '110px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontWeight: statusFilter === 'COMPLETED' ? '700' : '500',
                background: statusFilter === 'COMPLETED' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                color: statusFilter === 'COMPLETED' ? '#34d399' : 'var(--text-secondary)',
                border: statusFilter === 'COMPLETED' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Realizadas ({completedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('NOT_COMPLETED')}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontWeight: statusFilter === 'NOT_COMPLETED' ? '700' : '500',
                background: statusFilter === 'NOT_COMPLETED' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255,255,255,0.05)',
                color: statusFilter === 'NOT_COMPLETED' ? '#f87171' : 'var(--text-secondary)',
                border: statusFilter === 'NOT_COMPLETED' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <span>No realizadas ({notCompletedCount})</span>
            </button>
          </div>

          <input 
            type="text"
            className="form-input"
            placeholder="Buscar por socio o semana (ej. Carlos, 19/10)..."
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
                {searchTerm ? 'No se encontraron semanas para esa búsqueda.' : 'No hay registros en esta categoría.'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isCompleted = item.completed;
              const isCurrentInProgress = item.status === 'IN_PROGRESS';

              return (
                <div 
                  key={item.id || item.weekId} 
                  style={{ 
                    background: isCompleted
                      ? 'rgba(16, 185, 129, 0.04)'
                      : (isCurrentInProgress ? 'rgba(99, 102, 241, 0.06)' : 'rgba(239, 68, 68, 0.05)'), 
                    border: '1px solid var(--border-light)',
                    borderLeft: isCompleted
                      ? '3px solid #10b981'
                      : (isCurrentInProgress ? '3px solid var(--accent-primary)' : '3px solid #ef4444'),
                    borderRadius: '6px', 
                    padding: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.8rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>
                        {item.memberName}
                      </strong>
                      {item.isManual ? (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          Socio Manual
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.08)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.18)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          Socio
                        </span>
                      )}
                      {item.isSwap && item.originalAssigneeName && (
                        <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>
                          (Cambio con {item.originalAssigneeName})
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
                      <span>Semana: <strong>{item.weekRange}</strong></span>
                    </div>

                    {isCompleted ? (
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', marginTop: '2px' }}>
                        Validado por: <span style={{ color: '#e4e4e7' }}>{item.completedByName}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.73rem', color: isCurrentInProgress ? 'var(--accent-primary)' : '#f87171', marginTop: '2px' }}>
                        {isCurrentInProgress ? 'Semana actual (aún no marcada como completada)' : 'Semana finalizada sin registro de limpieza'}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', marginLeft: 'auto' }}>
                    {isCompleted ? (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          <span>Realizada</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {formatDate(item.completedAt)}
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={updatingWeekId === item.weekId}
                            onClick={() => handleToggleWeekByAdmin(item, false)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Desmarcar
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{
                          fontSize: '0.75rem',
                          color: isCurrentInProgress ? 'var(--accent-primary)' : '#f87171',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {isCurrentInProgress ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="15" y1="9" x2="9" y2="15"></line>
                              <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                          )}
                          <span>{isCurrentInProgress ? 'En curso' : 'No realizada'}</span>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={updatingWeekId === item.weekId}
                            onClick={() => handleToggleWeekByAdmin(item, true)}
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid #10b981',
                              color: '#34d399',
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Marcar esta semana como realizada (Admin)"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Validar</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie de modal */}
        <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Mostrando {filteredHistory.length} de {historyList.length} semanas
          </span>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
