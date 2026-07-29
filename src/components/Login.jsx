import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

import { ROLES } from '../utils/roleUtils';

// Helper para validar formato y erratas tipográficas comunes en dominios
const validateEmailFormat = (emailStr) => {
  const clean = (emailStr || '').trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(clean)) {
    return { valid: false, error: 'Por favor, introduce una dirección de correo válida.' };
  }

  const invalidTypoEndings = ['.con', '.cmo', '.coom', '.gmal', '.gmai', '.hotmai', '.outloo', '.yaho'];
  for (const typo of invalidTypoEndings) {
    if (clean.endsWith(typo)) {
      return { valid: false, error: `Error tipográfico detectado en el correo (termina en "${typo}"). ¿Querías decir .com / .es?` };
    }
  }

  return { valid: true };
};

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    // Validar erratas de email
    const emailCheck = validateEmailFormat(email);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error);
      return;
    }

    setLoading(true);

    try {
      if (isReset) {
        try {
          // Intentar primero con la URL de retorno del sitio actual
          await sendPasswordResetEmail(auth, email, { url: window.location.origin });
        } catch (actionErr) {
          // Fallback a envio estándar de Firebase si la URL de origen no está autorizada en la consola
          await sendPasswordResetEmail(auth, email);
        }
        setInfoMsg('✉️ ¡Correo de recuperación enviado! Revisa tu bandeja de entrada y la carpeta de SPAM / Correo No Deseado.');
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });

        // Enviar correo de verificación de email de Firebase
        try {
          await sendEmailVerification(userCredential.user);
        } catch (vErr) {
          console.warn("No se pudo enviar verificacion de email:", vErr);
        }

        // Crear documento del perfil en Firestore
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const isFirstUser = usersSnapshot.empty;

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: name || userCredential.user.email,
          role: isFirstUser ? ROLES.ADMIN : ROLES.NO_SOCIO,
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error("Auth error:", error);
      if (error.code === 'auth/user-not-found') {
        setErrorMsg('No existe ninguna cuenta registrada con este correo.');
      } else if (error.code === 'auth/wrong-password') {
        setErrorMsg('Contraseña incorrecta.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('Este correo ya está registrado.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg('El formato del correo electrónico no es válido.');
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMsg('Demasiados intentos fallidos. Inténtalo más tarde.');
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <h2 className="title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {isReset ? 'Recuperar Contraseña' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!isLogin && !isReset && (
            <div className="form-group">
              <label>Nombre (Avatar)</label>
              <input 
                type="text" 
                className="form-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin && !isReset}
              />
            </div>
          )}
          
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input 
              type="email" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {!isReset && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Contraseña</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={() => { setIsReset(true); setErrorMsg(''); setInfoMsg(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                className="form-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isReset}
              />
            </div>
          )}

          {errorMsg && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', textAlign: 'center' }}>
              {infoMsg}
            </div>
          )}

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Cargando...' : (isReset ? 'Enviar Enlace de Recuperación' : (isLogin ? 'Entrar' : 'Crear Cuenta'))}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
          {isReset ? (
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 1rem', width: '100%' }}
              onClick={() => { setIsReset(false); setErrorMsg(''); setInfoMsg(''); }}
            >
              Volver al inicio de sesión
            </button>
          ) : (
            <>
              {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem 1rem', marginTop: '0.5rem', width: '100%' }}
                onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); setInfoMsg(''); }}
              >
                {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
