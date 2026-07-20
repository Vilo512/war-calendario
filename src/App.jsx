import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase/config';
import CalendarView from './components/CalendarView';
import BookingModal from './components/BookingModal';
import CleaningCard from './components/CleaningCard';
import CalendarSync from './components/CalendarSync';
import Login from './components/Login';
import './index.css';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>Cargando sesión...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="title" style={{margin: 0, fontSize: '2rem'}}>WAR Calendario</h1>
          <p style={{color: 'var(--text-secondary)'}}>Gestión de Estudios</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Hola, {user.displayName || user.email}</span>
            <button 
              onClick={() => signOut(auth)} 
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, textAlign: 'right', fontSize: '0.8rem' }}
            >
              Cerrar sesión
            </button>
          </div>
          <button className="btn" onClick={() => setIsModalOpen(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span className="mobile-hidden">Nueva Reserva</span>
          </button>
        </div>
      </header>

      <CalendarSync />

      <div className="grid-dashboard">
        <div>
          <CalendarView user={user} />
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

      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} user={user} />
    </div>
  );
}

export default App;
