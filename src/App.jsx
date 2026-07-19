import React, { useState } from 'react';
import CalendarView from './components/CalendarView';
import BookingModal from './components/BookingModal';
import CleaningCard from './components/CleaningCard';
import CalendarSync from './components/CalendarSync';
import './index.css';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="app-container">
      <header className="header">
        <div>
          <h1 className="title" style={{margin: 0, fontSize: '2rem'}}>WAR Calendario</h1>
          <p style={{color: 'var(--text-secondary)'}}>Gestión de Estudios</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span className="mobile-hidden">Nueva Reserva</span>
        </button>
      </header>

      <CalendarSync />

      <div className="grid-dashboard">
        <div>
          <CalendarView />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <CleaningCard />
          <div className="glass-panel">
            <h3 style={{fontSize: '1.1rem', marginBottom: '0.5rem'}}>Estadísticas de Hoy</h3>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
              <span style={{color: 'var(--text-secondary)'}}>Ocupación</span>
              <span style={{fontWeight: 'bold', color: 'var(--accent-primary)'}}>85%</span>
            </div>
            <div style={{background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden'}}>
              <div style={{background: 'var(--accent-primary)', width: '85%', height: '100%', borderRadius: '4px'}}></div>
            </div>
          </div>
        </div>
      </div>

      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default App;
