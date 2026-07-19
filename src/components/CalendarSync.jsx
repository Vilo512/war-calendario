import React, { useState } from 'react';
import { downloadICalFeed } from '../services/icalService';

export default function CalendarSync() {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await downloadICalFeed();
    setTimeout(() => setDownloading(false), 2000);
  };

  const handleCopyUrl = () => {
    const feedUrl = 'https://geticalfeed-216846008793-uc.a.run.app';
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 1.5rem'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div className="sync-status">
          <div className="sync-dot pulse" style={{ backgroundColor: '#10b981' }}></div>
          <span style={{ fontWeight: 500 }}>Sincronización de Calendario</span>
        </div>
      </div>
      <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
        <button 
          className="btn" 
          onClick={handleDownload}
          disabled={downloading}
          style={{padding: '0.5rem 1rem', fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'}}
        >
          {downloading ? 'Descargando...' : 'Descargar .ics'}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={handleCopyUrl}
          style={{padding: '0.5rem 1rem', fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'}}
        >
          {copied ? '¡Copiado!' : 'Copiar URL Feed'}
        </button>
      </div>
      <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center'}}>
        * El Feed URL requiere deploy previo de Cloud Functions.
      </div>
    </div>
  );
}
