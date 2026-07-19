import React, { useState } from 'react';

export default function CleaningCard() {
  const [completed, setCompleted] = useState(false);

  if (completed) {
    return (
      <div className="glass-panel" style={{borderLeft: '4px solid var(--success)', display: 'flex', alignItems: 'center', gap: '1rem'}}>
        <div style={{background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div>
          <h3 style={{fontSize: '1.1rem', marginBottom: '0.2rem'}}>Limpieza Completada</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>Estudio A está listo para el próximo evento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel cleaning-card">
      <div className="cleaning-header">
        <div className="cleaning-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <div>
          <h3 style={{fontSize: '1.1rem', margin: 0}}>Atención de Limpieza</h3>
          <p style={{color: 'var(--accent-secondary)', fontSize: '0.85rem'}}>Prioridad Alta</p>
        </div>
      </div>
      <p style={{marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem'}}>
        El <strong>Estudio A</strong> requiere limpieza después de la sesión de retrato. Próximo evento en 45 min.
      </p>
      <button className="btn btn-success" style={{width: '100%'}} onClick={() => setCompleted(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Completar
      </button>
    </div>
  );
}
