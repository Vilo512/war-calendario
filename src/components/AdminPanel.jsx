import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function AdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'rooms'
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [msg, setMsg] = useState('');

  // Escuchar usuarios
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = [];
      snapshot.forEach((d) => uList.push({ id: d.id, ...d.data() }));
      setUsers(uList);
    });
    return () => unsub();
  }, []);

  // Escuchar salas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach((d) => rList.push({ id: d.id, ...d.data() }));
      setRooms(rList);
    });
    return () => unsub();
  }, []);

  // Cambiar rol de usuario
  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setMsg('Rol actualizado correctamente.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error("Error al actualizar rol:", err);
      setMsg('Error actualizando rol: ' + err.message);
    }
  };

  // Añadir nueva sala
  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const roomId = newRoomName.trim().replace(/\s+/g, '_');
    try {
      await setDoc(doc(db, 'rooms', roomId), {
        name: newRoomName.trim(),
        active: true,
        createdAt: new Date()
      });
      setNewRoomName('');
      setMsg('Sala añadida correctamente.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error("Error al añadir sala:", err);
      setMsg('Error creando sala: ' + err.message);
    }
  };

  // Borrar sala
  const handleDeleteRoom = async (roomId) => {
    if (window.confirm('¿Seguro que deseas eliminar esta sala?')) {
      try {
        await deleteDoc(doc(db, 'rooms', roomId));
        setMsg('Sala eliminada.');
        setTimeout(() => setMsg(''), 3000);
      } catch (err) {
        console.error("Error borrando sala:", err);
        setMsg('Error eliminando sala: ' + err.message);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      justify: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="title" style={{ margin: 0 }}>Panel de Administración</h2>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar ×</button>
        </div>

        {/* Pestanas */}
        <div className="view-toggles" style={{ marginBottom: '1.5rem' }}>
          <button 
            className={`toggle-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Gestión de Usuarios ({users.length})
          </button>
          <button 
            className={`toggle-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            Gestión de Salas ({rooms.length})
          </button>
        </div>

        {msg && <div style={{ marginBottom: '1rem', color: 'var(--accent-primary)', textAlign: 'center' }}>{msg}</div>}

        {/* Tab Usuarios */}
        {activeTab === 'users' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Lista de Socios y Registro</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {users.map((u) => (
                <div key={u.id} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{u.displayName || u.email}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estatus:</label>
                    <select 
                      className="form-input" 
                      style={{ padding: '0.4rem', width: 'auto' }}
                      value={u.role || 'no socio'}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="no socio">No Socio</option>
                      <option value="semisocio">Semisocio</option>
                      <option value="socio">Socio</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Salas */}
        {activeTab === 'rooms' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Estudios y Salas Disponibles</h3>
            
            <form onSubmit={handleAddRoom} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Nombre de nueva sala (ej: Zona Wargames)..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
              <button type="submit" className="btn" style={{ whitespace: 'nowrap' }}>+ Añadir Sala</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {rooms.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No hay salas creadas. (Se usarán las salas por defecto: Estudio A, Estudio B, Sala Conferencias).</p>
              ) : (
                rooms.map((r) => (
                  <div key={r.id} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                    <button 
                      className="btn" 
                      style={{ background: 'var(--danger)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => handleDeleteRoom(r.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
