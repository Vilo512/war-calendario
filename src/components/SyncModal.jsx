import React, { useState } from 'react';
import { downloadICalFromBookings } from '../services/icalService';

export default function SyncModal({ isOpen, onClose, visibleBookings = [], selectedRoomFilter = 'ALL', viewMode = 'month' }) {
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomLabel = selectedRoomFilter === 'ALL' ? 'Todas las salas' : selectedRoomFilter;
  const viewLabel = viewMode === 'month' ? 'Mes actual' : 'Semana actual';

  const feedUrl = selectedRoomFilter === 'ALL'
    ? 'https://geticalfeed-216846008793-uc.a.run.app'
    : `https://geticalfeed-216846008793-uc.a.run.app?room=${encodeURIComponent(selectedRoomFilter)}`;

  const webcalUrl = feedUrl.replace(/^https:\/\//, 'webcal://');

  const handleDownloadIcs = () => {
    const filename = `reservas_${roomLabel.toLowerCase().replace(/\s+/g, '_')}.ics`;
    downloadICalFromBookings(visibleBookings, filename);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handleCopyFeed = (urlToCopy) => {
    navigator.clipboard.writeText(urlToCopy);
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '1.8rem', borderRadius: '12px' }}>
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
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '0.3rem' }}>
            Filtro Activo: {viewLabel} ({roomLabel})
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Se exportarán <strong style={{ color: '#ffffff' }}>{visibleBookings.length} reservas</strong> visibles actualmente en tu pantalla.
          </div>
        </div>

        {/* Opciones de exportación / compatibilidad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.2rem' }}>
          {/* Opción Webcal Directa para Outlook y Apple */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Outlook / Apple (Protocolo webcal://)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Abre la suscripción en vivo en tu app de escritorio</div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button 
                  className="btn" 
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                  onClick={() => window.open(webcalUrl, '_self')}
                >
                  Abrir webcal://
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                  onClick={() => handleCopyFeed(webcalUrl)}
                >
                  {copied ? '✓ Copiado' : 'Copiar webcal'}
                </button>
              </div>
            </div>
          </div>

          {/* Opción iPhone / Apple Calendar / iCal */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.92rem', color: '#ffffff' }}>iPhone / iPad / Apple Calendar</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Añade los eventos visibles directamente a tu calendario nativo</div>
              </div>
              <button 
                className="btn" 
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                onClick={handleDownloadIcs}
                disabled={visibleBookings.length === 0}
              >
                {downloaded ? '✓ Añadido' : 'Añadir a mi iPhone'}
              </button>
            </div>
          </div>

          {/* Opción Google Calendar */}
          <div style={{ background: '#18181b', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Google Calendar</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Importa el archivo en tu cuenta de Google</div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => window.open('https://calendar.google.com/calendar/r/settings/export', '_blank')}
              >
                Abrir Google Cal
              </button>
            </div>
          </div>
        </div>

        {/* Nota aclaratoria de cuentas corporativas */}
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: '0.2rem' }}>Nota para Cuentas Corporativas / Institucionales (Generalitat):</strong>
          Las políticas de seguridad de Exchange/Microsoft 365 en administraciones públicas suelen bloquear suscripciones externas en cuentas de trabajo. Se recomienda usar una cuenta personal (Gmail/Outlook personal/iPhone) o instalar la App PWA directamente en tu teléfono móvil.
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
