import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ROLES, ROLE_LABELS, normalizeRole, isCleaningMember } from '../utils/roleUtils';
import { subscribeAllWeeks, resetWeekOverride } from '../services/cleaningSwapService';
import { 
  subscribeAllIncidents, 
  resolveIncident, 
  dismissIncident, 
  INCIDENT_TYPES 
} from '../services/cleaningIncidentService';
import { 
  createAnnouncement, 
  deleteAnnouncement, 
  subscribeAnnouncements 
} from '../services/announcementService';

export default function AdminPanel({ isOpen, onClose, user }) {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [cleaningMembers, setCleaningMembers] = useState([]);
  const [weeksMap, setWeeksMap] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'cleaning', 'incidents', 'announcements', 'rooms'

  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [manualMemberName, setManualMemberName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  
  const [ancTitle, setAncTitle] = useState('');
  const [ancContent, setAncContent] = useState('');
  const [ancPriority, setAncPriority] = useState('NORMAL');
  const [msg, setMsg] = useState('');

  // Escuchar usuarios
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setUsers(list);
    });
    return () => unsub();
  }, [isOpen]);

  // Escuchar salas
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setRooms(list);
    });
    return () => unsub();
  }, [isOpen]);

  // Escuchar cuadrante de limpieza
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, 'cleaning_schedule', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setCleaningMembers(docSnap.data().members || []);
      } else {
        setCleaningMembers([]);
      }
    });
    return () => unsub();
  }, [isOpen]);

  // Escuchar permutas/excepciones de semanas
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeAllWeeks((map) => {
      setWeeksMap(map);
    });
    return () => unsub();
  }, [isOpen]);

  // Escuchar incidencias de limpieza
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeAllIncidents((list) => {
      setIncidents(list);
    });
    return () => unsub();
  }, [isOpen]);

  // Escuchar anuncios oficiales
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeAnnouncements((list) => {
      setAnnouncements(list);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    if (!ancTitle.trim()) return;
    try {
      await createAnnouncement({
        title: ancTitle,
        content: ancContent,
        priority: ancPriority,
        user
      });
      setAncTitle('');
      setAncContent('');
      setAncPriority('NORMAL');
      setMsg('Anuncio oficial publicado con éxito.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error publicando anuncio: ' + err.message);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('¿Eliminar este anuncio oficial?')) {
      try {
        await deleteAnnouncement(id);
        setMsg('Anuncio eliminado.');
        setTimeout(() => setMsg(''), 3000);
      } catch (err) {
        setMsg('Error eliminando anuncio: ' + err.message);
      }
    }
  };

  // Cambiar rol de un usuario
  const handleRoleChange = async (targetUserId, newRoleValue) => {
    try {
      const numericRole = typeof newRoleValue === 'number' ? newRoleValue : parseInt(newRoleValue, 10);
      await updateDoc(doc(db, 'users', targetUserId), { role: numericRole });
      setMsg('Estatus de usuario actualizado.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error("Error al actualizar rol:", err);
      setMsg('Error al actualizar estatus: ' + err.message);
    }
  };

  // Guardar lista completa del cuadrante
  const saveCleaningMembers = async (membersList) => {
    try {
      await setDoc(doc(db, 'cleaning_schedule', 'config'), {
        members: membersList,
        startDate: new Date()
      }, { merge: true });
      setMsg('Cuadrante de limpieza actualizado.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error("Error al guardar cuadrante:", err);
      setMsg('Error al guardar cuadrante: ' + err.message);
    }
  };

  // Añadir socio registrado a la lista
  const handleAddRegisteredToCleaning = () => {
    if (!selectedUserToAdd) return;
    const targetUser = users.find(u => u.id === selectedUserToAdd);
    if (!targetUser) return;

    if (cleaningMembers.some(m => m.id === targetUser.id)) {
      alert('Este usuario ya está en el cuadrante de limpieza.');
      return;
    }

    const newItem = {
      id: targetUser.id,
      uid: targetUser.uid || targetUser.id,
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
      setMsg('Nueva sala creada.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error creando sala: ' + err.message);
    }
  };

  // Eliminar sala
  const handleDeleteRoom = async (roomId) => {
    if (window.confirm('¿Eliminar esta sala?')) {
      try {
        await deleteDoc(doc(db, 'rooms', roomId));
        setMsg('Sala eliminada.');
        setTimeout(() => setMsg(''), 3000);
      } catch (err) {
        setMsg('Error eliminando sala: ' + err.message);
      }
    }
  };

  const sociosAndAdmins = users.filter(u => isCleaningMember(u.role));

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 12, 0.94)',
      display: 'flex',
      justifyContent: 'center',
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
        <div className="view-toggles" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '4px', background: '#18181b', borderRadius: '8px' }}>
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
            className={`toggle-btn ${activeTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setActiveTab('incidents')}
            style={
              activeTab === 'incidents'
                ? (incidents.filter(i => i.status === 'OPEN').length > 0
                    ? { background: 'var(--danger)', color: '#ffffff', fontWeight: '800' }
                    : { background: '#ffffff', color: '#000000', fontWeight: '800' })
                : (incidents.filter(i => i.status === 'OPEN').length > 0
                    ? { border: '1px solid var(--danger)', color: 'var(--danger)' }
                    : {})
            }
          >
            Incidencias {incidents.filter(i => i.status === 'OPEN').length > 0 && `(${incidents.filter(i => i.status === 'OPEN').length})`}
          </button>
          <button 
            className={`toggle-btn ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcements')}
          >
            Anuncios ({announcements.length})
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
                      value={normalizeRole(u.role)}
                      onChange={(e) => handleRoleChange(u.id, parseInt(e.target.value, 10))}
                    >
                      <option value={ROLES.NO_SOCIO}>{ROLE_LABELS[ROLES.NO_SOCIO]}</option>
                      <option value={ROLES.SEMISOCIO}>{ROLE_LABELS[ROLES.SEMISOCIO]}</option>
                      <option value={ROLES.SOCIO}>{ROLE_LABELS[ROLES.SOCIO]}</option>
                      <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
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

            {/* Cambios Aceptados e Intercambios */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.2rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>Cambios Aceptados y Excepciones Activas</h4>
              
              {Object.keys(weeksMap).filter(wId => wId !== 'config' && weeksMap[wId]?.isSwap).length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay cambios de turno o excepciones activas en este momento.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.keys(weeksMap)
                    .filter(wId => wId !== 'config' && weeksMap[wId]?.isSwap)
                    .map(wId => {
                      const data = weeksMap[wId];
                      return (
                        <div key={wId} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 'bold', marginRight: '6px' }}>Semana {wId}:</span>
                            <span>{data.assigneeName}</span>
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginLeft: '6px' }}>(Original: {data.originalAssigneeName})</span>
                          </div>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={async () => {
                              if (window.confirm(`¿Restablecer la semana ${wId} al socio original (${data.originalAssigneeName})?`)) {
                                await resetWeekOverride(wId);
                              }
                            }}
                          >
                            Restablecer Original
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Incidencias */}
        {activeTab === 'incidents' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--danger)' }}>
              ⚠️ Registro de Incidencias de Limpieza
            </h3>

            {incidents.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No hay ninguna incidencia de limpieza registrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {incidents.map(inc => (
                  <div 
                    key={inc.id} 
                    className="booking-item" 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem',
                      borderLeft: inc.status === 'OPEN' ? '4px solid var(--danger)' : '4px solid var(--text-secondary)',
                      background: inc.status === 'OPEN' ? 'rgba(239, 68, 68, 0.06)' : undefined
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                        {INCIDENT_TYPES[inc.type] || inc.type}
                      </div>
                      <div>
                        {inc.status === 'OPEN' ? (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                            Abierta / Pendiente
                          </span>
                        ) : inc.status === 'RESOLVED' ? (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                            ✓ Resuelta
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '12px' }}>
                            Descartada
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <span>Semana: <strong>{inc.weekRange || inc.weekId}</strong></span> | 
                      <span style={{ marginLeft: '6px' }}>Asignado: <strong style={{ color: 'var(--accent-primary)' }}>{inc.assignedMemberName}</strong></span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Reportado por: <strong>{inc.reporterName}</strong>
                    </div>

                    {inc.description && (
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        "{inc.description}"
                      </div>
                    )}

                    {inc.status === 'OPEN' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}
                          onClick={async () => {
                            await dismissIncident(inc.id);
                            setMsg('Incidencia descartada.');
                            setTimeout(() => setMsg(''), 3000);
                          }}
                        >
                          Descartar
                        </button>
                        <button 
                          className="btn btn-success" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={async () => {
                            await resolveIncident(inc.id);
                            setMsg('Incidencia marcada como resuelta.');
                            setTimeout(() => setMsg(''), 3000);
                          }}
                        >
                          ✓ Resolver Incidencia
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Anuncios */}
        {activeTab === 'announcements' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>
              Tablero de Anuncios y Comunicados Oficiales
            </h3>

            {/* Formulario de publicación */}
            <form onSubmit={handleAddAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                  Título del Anuncio:
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Cierre de instalaciones por mantenimiento el Sábado..."
                  value={ancTitle}
                  onChange={(e) => setAncTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                  Mensaje / Contenido (Opcional):
                </label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  placeholder="Detalles sobre el evento o aviso..."
                  value={ancContent}
                  onChange={(e) => setAncContent(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Prioridad:</label>
                  <select 
                    className="form-input" 
                    style={{ padding: '0.3rem 0.6rem', width: 'auto' }}
                    value={ancPriority}
                    onChange={(e) => setAncPriority(e.target.value)}
                  >
                    <option value="NORMAL">Normal (Comunicado)</option>
                    <option value="URGENT">Urgente (Aviso Oficial)</option>
                  </select>
                </div>

                <button type="submit" className="btn" style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem' }}>
                  + Publicar Anuncio
                </button>
              </div>
            </form>

            {/* Listado de anuncios publicados */}
            <h4 style={{ fontSize: '1rem', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>Anuncios Publicados</h4>

            {announcements.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay anuncios publicados. Crea el primero arriba.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {announcements.map(a => (
                  <div key={a.id} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{a.title}</span>
                        {a.priority === 'URGENT' && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Urgente
                          </span>
                        )}
                      </div>
                      {a.content && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0', whiteSpace: 'pre-wrap' }}>
                          {a.content}
                        </p>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                        Por {a.createdBy || 'Admin'}
                      </div>
                    </div>
                    <button 
                      className="btn" 
                      style={{ background: 'var(--danger)', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => handleDeleteAnnouncement(a.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
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
