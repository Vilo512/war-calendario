import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDocs, collection, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import CalendarView from './components/CalendarView';
import BookingModal from './components/BookingModal';
import CleaningCard from './components/CleaningCard';
import CalendarSync from './components/CalendarSync';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import { getRoleLabel, isAdminRole, ROLES } from './utils/roleUtils';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    let unsubProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Escuchar perfil del usuario en Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // Si es el primer usuario en la BD, asignar admin automaticamente
            try {
              const usersSnap = await getDocs(collection(db, 'users'));
              const isFirst = usersSnap.empty;
              const newRole = isFirst ? ROLES.ADMIN : ROLES.NO_SOCIO;
              const newProfile = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email,
                role: newRole,
                createdAt: new Date()
              };
              setUserProfile(newProfile);
              await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            } catch (err) {
              console.error("Error al crear perfil inicial:", err);
              setUserProfile({ role: ROLES.NO_SOCIO });
            }
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
  const roleLabel = getRoleLabel(userRole);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '14px', 
            background: '#ffffff', 
            color: '#09090b', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 0 24px rgba(255, 255, 255, 0.2)' 
          }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" fill="currentColor" fillOpacity="0.12" />
              <path d="M12 22V12" />
              <path d="M12 12L4 7" />
              <path d="M12 12l8-7" />
              <circle cx="12" cy="7" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="title" style={{margin: 0, fontSize: '1.9rem', letterSpacing: '-0.02em'}}>WAR CALENDARIO</h1>
            <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600}}>
              Asociación de Juegos · Los Cuervos
            </p>
          </div>
        </div>

        <div className="header-user-section">
          <div className="header-user-info" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Hola, <strong style={{ color: '#ffffff' }}>{user.displayName || user.email}</strong>
              <span style={{ 
                marginLeft: '8px', 
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
                boxShadow: '0 2px 6px rgba(0,0,0,0.8)'
              }}>
                {roleLabel}
              </span>
            </span>
            <button 
              onClick={() => signOut(auth)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, textAlign: 'inherit', fontSize: '0.8rem', marginTop: '2px' }}
            >
              Cerrar sesión
            </button>
          </div>

          <div className="header-actions">
            {isAdmin && (
              <button className="btn btn-secondary" onClick={() => setIsAdminOpen(true)} style={{ borderColor: 'var(--accent-primary)' }}>
                ⚙️ Admin Panel
              </button>
            )}

            <button className="btn" onClick={() => setIsModalOpen(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Nueva Reserva</span>
            </button>
          </div>
        </div>
      </header>

      <CalendarSync />

      <div className="grid-dashboard">
        <div>
          <CalendarView user={user} userRole={userRole} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <CleaningCard user={user} userRole={userRole} />
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

      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} user={user} userRole={userRole} />
      
      {isAdminOpen && <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} user={user} />}
    </div>
  );
}
