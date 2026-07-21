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
import './index.css';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let unsubProfile = null;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // Si el perfil no existe en Firestore, comprobar si la colección de perfiles está vacía
            try {
              const usersSnap = await getDocs(collection(db, 'users'));
              const isFirst = usersSnap.empty;
              const newRole = isFirst ? 'admin' : 'no socio';
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
              setUserProfile({ role: 'no socio' });
            }
          }
          setLoadingAuth(false);
        }, (error) => {
          console.error("Error leyendo perfil de usuario:", error);
          setUserProfile({ role: 'no socio' });
          setLoadingAuth(false);
        });
      } else {
        setUserProfile(null);
        setLoadingAuth(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  if (loadingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>Cargando sesión...</div>;
  }

  if (!user) {
    return <Login />;
  }

  const userRole = userProfile ? userProfile.role : 'no socio';
  const isAdmin = userRole === 'admin';

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title" style={{margin: 0, fontSize: '2rem'}}>WAR Calendario</h1>
          <p style={{color: 'var(--text-secondary)'}}>Gestión de Estudios</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Hola, {user.displayName || user.email}
              <span style={{ 
                marginLeft: '6px', 
                fontSize: '0.75rem', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                background: isAdmin ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
                color: 'white',
                textTransform: 'capitalize'
              }}>
                {userRole}
              </span>
            </span>
            <button 
              onClick={() => signOut(auth)} 
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, textAlign: 'right', fontSize: '0.8rem' }}
            >
              Cerrar sesión
            </button>
          </div>

          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setIsAdminOpen(true)} style={{ borderColor: 'var(--accent-primary)' }}>
              ⚙️ Admin Panel
            </button>
          )}

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
      
      {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}
    </div>
  );
}

export default App;
