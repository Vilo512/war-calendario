import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
      }
    } catch (error) {
      console.error("Auth error:", error);
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <h2 className="title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!isLogin && (
            <div className="form-group">
              <label>Nombre (Avatar)</label>
              <input 
                type="text" 
                className="form-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
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
          
          <div className="form-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Cargando...' : (isLogin ? 'Entrar' : 'Crear Cuenta')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', marginTop: '0.5rem', width: '100%' }}
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
          >
            {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
