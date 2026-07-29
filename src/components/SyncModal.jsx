import React, { useState } from 'react';

export default function SyncModal({ isOpen, onClose, visibleBookings = [], selectedRoomFilter = 'ALL', viewMode = 'month' }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomLabel = selectedRoomFilter === 'ALL' ? 'Todas las salas' : selectedRoomFilter;

  // Base URL para el feed iCal (dinámico según el dominio actual)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://warlendario.vercel.app';
  const baseUrl = `${origin}/api/ical`;
  const feedUrl = selectedRoomFilter === 'ALL'
    ? baseUrl
    : `${baseUrl}?room=${encodeURIComponent(selectedRoomFilter)}`;

  const webcalUrl = feedUrl.replace(/^https:\/\//, 'webcal://');

  const handleCopyFeed = (urlToCopy) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        overflowY: 'auto'
      }}
    >
      <div 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          maxWidth: '540px', 
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem', 
          borderRadius: '12px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 className="title" style={{ margin: 0, fontSize: '1.2rem' }}>Sincronizar Calendario</h3>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '1.1rem', borderRadius: '6px', cursor: 'pointer' }} 
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Resumen del filtro activo */}
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '0.3rem' }}>
            Filtro Activo: {roomLabel}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Se sincronizarán todas las reservas de <strong>{roomLabel}</strong> en tiempo real.
          </div>
        </div>

        {/* Opciones de exportación / compatibilidad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.2rem' }}>
          
          {/* Opción Destacada: iPhone / Apple Calendar / iCal con <a> nativo */}
          <div style={{ background: '#18181b', padding: '1rem', borderRadius: '8px', border: '2px solid #ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#ffffff' }}>
                  iPhone / iPad / Apple Calendar
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Sincronización en vivo con la app Calendario de iOS
                </div>
              </div>
              <a 
                href={webcalUrl}
                className="btn" 
                style={{ 
                  fontSize: '0.82rem', 
                  padding: '0.5rem 1rem',
                  textDecoration: 'none',
                  background: '#ffffff',
                  color: '#000000',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(255,255,255,0.2)'
                }}
              >
                Suscribirse en iPhone
              </a>
            </div>
          </div>

          {/* Opción Google Calendar */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Google Calendar</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Suscríbete desde tu cuenta de Google</div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`, '_blank')}
              >
                Suscribirse en Google
              </button>
            </div>
          </div>

          {/* Opción Webcal / URL Feed */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Copiar URL de Suscripción</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Para Outlook o configuración manual</div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => handleCopyFeed(feedUrl)}
              >
                {copied ? '✓ Copiado' : 'Copiar Enlace'}
              </button>
            </div>
          </div>
        </div>

        {/* Nota aclaratoria de cuentas corporativas */}
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: '0.2rem' }}>Nota importante sobre sincronización:</strong>
          • Las reservas nuevas o modificadas pueden tardar en aparecer según la frecuencia de refresco de tu app (Google/Apple).<br/>
          • Si usas una cuenta corporativa de Microsoft 365, su política de seguridad puede bloquear suscripciones externas.
        </div>
      </div>
    </div>
  );
}



