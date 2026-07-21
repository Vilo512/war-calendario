import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';

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
    setLoading(true);

    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        setInfoMsg('¡Correo de recuperación enviado! Revisa tu bandeja de entrada.');
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
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
