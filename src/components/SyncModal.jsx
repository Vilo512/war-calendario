import React, { useState } from 'react';
import { downloadICalFromBookings } from '../services/icalService';

export default function SyncModal({ isOpen, onClose, visibleBookings = [], selectedRoomFilter = 'ALL', viewMode = 'month' }) {
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomLabel = selectedRoomFilter === 'ALL' ? 'Todas las salas' : selectedRoomFilter;
  const viewLabel = viewMode === 'month' ? 'Mes actual' : 'Semana actual';

  const handleDownloadIcs = () => {
    const filename = `reservas_${roomLabel.toLowerCase().replace(/\s+/g, '_')}.ics`;
    downloadICalFromBookings(visibleBookings, filename);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handleCopyFeed = () => {
    const feedUrl = 'https://geticalfeed-216846008793-uc.a.run.app';
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '1.8rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 className="title" style={{ margin: 0, fontSize: '1.3rem' }}>Sincronizar Calendario</h3>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', height: '32px', minWidth: '32px', borderRadius: '4px' }} 
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Resumen del filtro activo */}
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1.2rem', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '0.3rem' }}>
            Filtro Activo: {viewLabel} ({roomLabel})
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Se exportarán <strong style={{ color: '#ffffff' }}>{visibleBookings.length} reservas</strong> visibles actualmente en tu pantalla.
          </div>
        </div>

        {/* Opciones de exportación / compatibilidad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
          {/* Opción Apple Calendar / iPhone / Outlook */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>iPhone / Apple / Outlook (.ics)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Añade directamente los eventos a tu aplicación nativa</div>
              </div>
              <button 
                className="btn" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={handleDownloadIcs}
                disabled={visibleBookings.length === 0}
              >
                {downloaded ? '✓ Exportado' : 'Añadir / Descargar .ics'}
              </button>
            </div>
          </div>

          {/* Opción Google Calendar */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Google Calendar</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Importa el archivo .ics en tu cuenta de Google</div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => window.open('https://calendar.google.com/calendar/r/settings/export', '_blank')}
              >
                Abrir Google Cal
              </button>
            </div>
          </div>

          {/* Opción URL Feed */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Sincronización Automática (URL Feed)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Suscripción iCal en tiempo real para todas las reservas</div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={handleCopyFeed}
              >
                {copied ? '✓ Copiado' : 'Copiar URL Feed'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
