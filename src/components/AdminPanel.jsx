import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function AdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'cleaning', 'rooms'
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [cleaningMembers, setCleaningMembers] = useState([]);
  const [manualMemberName, setManualMemberName] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
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

  // Escuchar lista de limpieza
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'cleaning_schedule', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setCleaningMembers(docSnap.data().members || []);
      } else {
        setCleaningMembers([]);
      }
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

  // Guardar lista de limpieza
  const saveCleaningMembers = async (newList) => {
    try {
      setCleaningMembers(newList);
      const configRef = doc(db, 'cleaning_schedule', 'config');
      const docSnap = await getDoc(configRef);
      if (!docSnap.exists()) {
        await setDoc(configRef, {
          members: newList,
          startDate: new Date()
        });
      } else {
        await updateDoc(configRef, { members: newList });
      }
      setMsg('Cuadrante de limpieza guardado.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error("Error guardando cuadrante:", err);
      setMsg('Error guardando limpieza: ' + err.message);
    }
  };

  // Añadir socio registrado a la lista de limpieza
  const handleAddRegisteredToCleaning = () => {
    if (!selectedUserToAdd) return;
    const targetUser = users.find(u => u.id === selectedUserToAdd);
    if (!targetUser) return;
    
    // Evitar duplicados por UID
    if (cleaningMembers.some(m => m.uid === targetUser.uid)) {
      setMsg('Este socio ya está en la lista de limpieza.');
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    const newItem = {
      id: targetUser.uid,
      uid: targetUser.uid,
      name: targetUser.displayName || targetUser.email,
      isManual: false
    };
    saveCleaningMembers([...cleaningMembers, newItem]);
    setSelectedUserToAdd('');
  };

  // Añadir socio manual (sin cuenta web) a la lista
  const handleAddManualToCleaning = (e) => {
    e.preventDefault();
    if (!manualMemberName.trim()) return;
    const newItem = {
      id: 'manual_' + Date.now(),
      uid: null,
      name: manualMemberName.trim() + ' (Manual)',
      isManual: true
    };
    saveCleaningMembers([...cleaningMembers, newItem]);
    setManualMemberName('');
  };

  // Mover elemento arriba/abajo
  const moveMember = (index, direction) => {
    const newList = [...cleaningMembers];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    saveCleaningMembers(newList);
  };

  // Borrar miembro de la lista de limpieza
  const removeMember = (index) => {
    const newList = cleaningMembers.filter((_, i) => i !== index);
    saveCleaningMembers(newList);
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

  const sociosAndAdmins = users.filter(u => u.role === 'socio' || u.role === 'admin');

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
        <div className="view-toggles" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button 
            className={`toggle-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Usuarios ({users.length})
          </button>
          <button 
            className={`toggle-btn ${activeTab === 'cleaning' ? 'active' : ''}`}
            onClick={() => setActiveTab('cleaning')}
          >
            Cuadrante Limpieza ({cleaningMembers.length})
          </button>
          <button 
            className={`toggle-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            Salas ({rooms.length})
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

        {/* Tab Limpieza */}
        {activeTab === 'cleaning' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Configuración del Cuadrante Rotativo</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Añadir socio registrado */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select 
                  className="form-input" 
                  style={{ flex: 1 }}
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                >
                  <option value="">-- Seleccionar Socio Registrado --</option>
                  {sociosAndAdmins.map(u => (
                    <option key={u.id} value={u.id}>{u.displayName || u.email} ({u.role})</option>
                  ))}
                </select>
                <button className="btn" onClick={handleAddRegisteredToCleaning}>+ Añadir a Limpieza</button>
              </div>

              {/* Añadir socio manual (sin web) */}
              <form onSubmit={handleAddManualToCleaning} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Nombre de socio sin cuenta web (ej. Paco)..."
                  value={manualMemberName}
                  onChange={(e) => setManualMemberName(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary" style={{ whitespace: 'nowrap' }}>+ Añadir Manual</button>
              </form>
            </div>

            <h4 style={{ fontSize: '1rem', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>Orden Rotativo Actual (Semana tras semana)</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cleaningMembers.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No hay nadie en la lista de limpieza. Añade socios arriba.</p>
              ) : (
                cleaningMembers.map((m, idx) => (
                  <div key={m.id + '_' + idx} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', marginRight: '8px' }}>#{idx + 1}</span>
                      <span>{m.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => moveMember(idx, -1)} disabled={idx === 0}>▲</button>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => moveMember(idx, 1)} disabled={idx === cleaningMembers.length - 1}>▼</button>
                      <button className="btn" style={{ background: 'var(--danger)', padding: '0.2rem 0.5rem' }} onClick={() => removeMember(idx)}>×</button>
                    </div>
                  </div>
                ))
              )}
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
