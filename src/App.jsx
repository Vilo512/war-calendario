import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDocs, collection, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import CalendarView from './components/CalendarView';
import BookingModal from './components/BookingModal';
import CleaningCard from './components/CleaningCard';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import AnnouncementBanner from './components/AnnouncementBanner';
import AnalyticsPage from './pages/AnalyticsPage';
import { getRoleLabel, isAdminRole, ROLES, subscribeRoleLabels, DEFAULT_ROLE_LABELS } from './utils/roleUtils';
import { subscribeOpenIncidents } from './services/cleaningIncidentService';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [openIncidentsCount, setOpenIncidentsCount] = useState(0);
  const [bookingInitialData, setBookingInitialData] = useState({ date: '', room: '' });
  const [duplicateBookingData, setDuplicateBookingData] = useState(null);
  const [customRoleLabels, setCustomRoleLabels] = useState(DEFAULT_ROLE_LABELS);

  const handleOpenBooking = (initialDate = '', initialRoom = '') => {
    setDuplicateBookingData(null);
    setBookingInitialData({ date: initialDate, room: initialRoom });
    setIsModalOpen(true);
  };

  const handleDuplicateBooking = (booking) => {
    setDuplicateBookingData(booking);
    setBookingInitialData({ date: booking.date || '', room: booking.room || '' });
    setIsModalOpen(true);
  };

  useEffect(() => {
    let unsubProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Escuchar perfil del usuario en Firestore (Lectura pasiva estricta)
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // Si el documento no existe en Firestore, crear perfil estándar
            const newProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || currentUser.email,
              role: ROLES.NO_SOCIO,
              createdAt: new Date()
            };
            setUserProfile(newProfile);
            setDoc(userDocRef, newProfile).catch(err => console.error("Error creando perfil inicial:", err));
          }
          setLoadingAuth(false);
        }, (error) => {
          console.error("Error leyendo perfil de usuario:", error);
          setUserProfile({ role: ROLES.NO_SOCIO });
          setLoadingAuth(false);
        });
      } else {
        setUserProfile(null);
        setLoadingAuth(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Escuchar incidencias abiertas (Badge Admin)
  useEffect(() => {
    const unsub = subscribeOpenIncidents((list) => {
      setOpenIncidentsCount(list.length);
    });
    return () => unsub();
  }, []);

  // Escuchar configuración dinámica de nombres de estatus
  useEffect(() => {
    const unsub = subscribeRoleLabels((labels) => {
      setCustomRoleLabels(labels);
    });
    return () => unsub();
  }, []);

  if (loadingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Cargando WAR Calendario...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const userRole = userProfile ? userProfile.role : ROLES.NO_SOCIO;
  const isAdmin = isAdminRole(userRole);
  const roleLabel = getRoleLabel(userRole, customRoleLabels);

  // Enrutamiento nativo muy simple
  if (window.location.pathname === '/analytics') {
    return (
      <div className="app-container">
        <header className="header">
          <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            <img 
              src="/logo-circulo.png" 
              alt="Logo W.A.R." 
              style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 25px rgba(255, 255, 255, 0.25)', border: '2.5px solid rgba(255, 255, 255, 0.3)', flexShrink: 0 }} 
            />
            <div>
              <h1 className="title header-title" style={{margin: 0, letterSpacing: '0.04em', lineHeight: 1.1}}>W.A.R.lendario</h1>
              <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: 0, marginTop: '2px'}}>
                Volver al Calendario
              </p>
            </div>
          </div>
        </header>
        <AnalyticsPage user={user} userRole={userRole} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <img 
            src="/logo-circulo.png" 
            alt="Logo W.A.R." 
            style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%',
              objectFit: 'cover',
              boxShadow: '0 0 25px rgba(255, 255, 255, 0.25)',
              border: '2.5px solid rgba(255, 255, 255, 0.3)',
              flexShrink: 0
            }} 
          />
          <div>
            <h1 className="title header-title" style={{margin: 0, letterSpacing: '0.04em', lineHeight: 1.1}}>W.A.R.lendario</h1>
            <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: 0, marginTop: '2px'}}>
              Wargames and Rol Lleida
            </p>
          </div>
        </div>

        <div className="header-user-section">
          <div className="header-user-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span>Hola, <strong style={{ color: '#ffffff' }}>{user.displayName || user.email}</strong></span>
              <span 
                style={{ 
                  fontSize: '0.75rem', 
                  padding: '3px 8px', 
                  borderRadius: '4px', 
                  fontWeight: '800',
                  fontFamily: "var(--font-stencil)",
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  border: isAdmin ? '1px solid #ffffff' : (roleLabel === 'Socio' ? '1px solid #10b981' : '1px solid #52525b'),
                  background: isAdmin ? '#ffffff' : (roleLabel === 'Socio' ? '#064e3b' : '#18181b'), 
                  color: isAdmin ? '#000000' : (roleLabel === 'Socio' ? '#34d399' : '#e4e4e7'),
                  boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
                  whiteSpace: 'nowrap'
                }}
              >
                {roleLabel}
              </span>
              <button 
                onClick={() => signOut(auth)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 4px', fontSize: '0.8rem', textDecoration: 'underline', opacity: 0.85 }}
              >
                (Cerrar sesión)
              </button>
            </span>
          </div>

          <div className="header-actions">
            {isAdmin && (
              <>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => window.location.href = '/analytics'} 
                  style={{ borderColor: 'var(--accent-secondary)' }}
                >
                  📊 Analíticas
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setIsAdminOpen(true)} 
                  style={{ 
                    borderColor: openIncidentsCount > 0 ? 'var(--danger)' : 'var(--accent-primary)',
                    position: 'relative'
                  }}
                >
                  Admin Panel
                {openIncidentsCount > 0 && (
                  <span style={{ 
                    position: 'absolute', 
                    top: '-6px', 
                    right: '-6px', 
                    background: 'var(--danger)', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: '18px', 
                    height: '18px', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)'
                  }}>
                    {openIncidentsCount}
                  </span>
                )}
              </button>
              </>
            )}

            <button className="btn" onClick={() => handleOpenBooking()}>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Nueva Reserva</span>
            </button>
          </div>
        </div>
      </header>

      <AnnouncementBanner />

      <div className="grid-dashboard">
        <div>
          <CalendarView 
            user={user} 
            userRole={userRole} 
            onOpenBooking={handleOpenBooking} 
            onDuplicateBooking={handleDuplicateBooking}
          />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <CleaningCard user={user} userRole={userRole} />
        </div>
      </div>

      <BookingModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setDuplicateBookingData(null);
        }} 
        user={user} 
        userRole={userRole} 
        initialDate={bookingInitialData.date}
        initialRoom={bookingInitialData.room}
        duplicateBookingData={duplicateBookingData}
      />
      
      {isAdminOpen && <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} user={user} />}
      
      <footer style={{ textAlign: 'center', padding: '2rem 1rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.7 }}>
        WAR Calendario - v1.0.0
      </footer>
    </div>
  );
}
