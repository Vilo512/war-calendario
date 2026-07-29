import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDoc, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  ROLES, 
  DEFAULT_ROLE_LABELS, 
  normalizeRole, 
  isCleaningMember,
  getRoleLabel,
  subscribeRoleLabels,
  updateRoleLabels
} from '../utils/roleUtils';
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
import CleaningHistoryModal from './CleaningHistoryModal';
import { recordCleaningHistory } from '../services/cleaningHistoryService';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { getWeekId, formatWeekRange } from '../utils/cleaningUtils';

export default function AdminPanel({ isOpen, onClose, user }) {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [cleaningMembers, setCleaningMembers] = useState([]);
  const [weeksMap, setWeeksMap] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'cleaning', 'incidents', 'announcements', 'rooms'
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [manualMemberName, setManualMemberName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  
  const [ancTitle, setAncTitle] = useState('');
  const [ancContent, setAncContent] = useState('');
  const [ancPriority, setAncPriority] = useState('NORMAL');
  const [ancDuration, setAncDuration] = useState('0'); // '0' = permanente, '1', '3', '7', '14', '30'
  const [ancWhatsApp, setAncWhatsApp] = useState(true);
  const [msg, setMsg] = useState('');

  const handleAdminMarkComplete = async (member) => {
    if (!member) return;
    if (window.confirm(`¿Confirmar y registrar la limpieza del socio "${member.name}" para esta semana en el histórico?`)) {
      try {
        const currentWeekId = getWeekId();
        const currentWeekRange = formatWeekRange();
        await setDoc(doc(db, 'cleaning_schedule', currentWeekId), {
          completed: true,
          completedBy: `${user?.displayName || 'Admin'} (Validación Admin)`,
          completedAt: new Date(),
          weekRange: currentWeekRange
        }, { merge: true });

        await recordCleaningHistory({
          weekId: currentWeekId,
          weekRange: currentWeekRange,
          memberId: member.id || 'manual',
          memberName: member.name,
          isManual: Boolean(member.isManual),
          completedByUid: user?.uid || 'admin',
          completedByName: `${user?.displayName || user?.email || 'Admin'} (Admin)`
        });

        setMsg(`✓ Limpieza del socio "${member.name}" guardada con éxito en el histórico.`);
        setTimeout(() => setMsg(''), 4000);
      } catch (err) {
        console.error("Error al registrar limpieza desde Admin:", err);
        setMsg('Error al registrar limpieza: ' + err.message);
      }
    }
  };

  const [purgeMonth, setPurgeMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [purgeYear, setPurgeYear] = useState(String(new Date().getFullYear()));

  const monthOptions = [
    { value: '01', name: 'Enero' },
    { value: '02', name: 'Febrero' },
    { value: '03', name: 'Marzo' },
    { value: '04', name: 'Abril' },
    { value: '05', name: 'Mayo' },
    { value: '06', name: 'Junio' },
    { value: '07', name: 'Julio' },
    { value: '08', name: 'Agosto' },
    { value: '09', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
  ];

  const handlePurgeMonthBookings = async () => {
    const targetPrefix = `${purgeYear}-${purgeMonth}`;
    const monthName = monthOptions.find(m => m.value === purgeMonth)?.name || purgeMonth;
    
    if (window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar TODAS las reservas del mes de ${monthName} de ${purgeYear}?`)) {
      try {
        const snapshot = await getDocs(collection(db, 'bookings'));
        let count = 0;
        const deletePromises = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.date && String(d.date).startsWith(targetPrefix)) {
            deletePromises.push(deleteDoc(doc(db, 'bookings', docSnap.id)));
            count++;
          }
        });
        await Promise.all(deletePromises);
        setMsg(`✓ Se han eliminado ${count} reserva(s) de ${monthName} ${purgeYear}.`);
        setTimeout(() => setMsg(''), 4000);
      } catch (err) {
        setMsg('Error limpiando reservas del mes: ' + err.message);
      }
    }
  };

  const handlePurgeAllBookings = async () => {
    if (window.confirm('🚨 ¿Estás SEGURO de que deseas vaciar ABSOLUTAMENTE TODAS las reservas del calendario?')) {
      try {
        const snapshot = await getDocs(collection(db, 'bookings'));
        let count = 0;
        const deletePromises = [];
        snapshot.forEach((docSnap) => {
          deletePromises.push(deleteDoc(doc(db, 'bookings', docSnap.id)));
          count++;
        });
        await Promise.all(deletePromises);
        setMsg(`✓ Se han eliminado TODAS las reservas del sistema (${count} en total).`);
        setTimeout(() => setMsg(''), 4000);
      } catch (err) {
        setMsg('Error vaciando el calendario: ' + err.message);
      }
    }
  };

  const [roleLabelsState, setRoleLabelsState] = useState(DEFAULT_ROLE_LABELS);

  // Escuchar nombres de estatus
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeRoleLabels((labels) => {
      setRoleLabelsState(labels);
    });
    return () => unsub();
  }, [isOpen]);

  const handleSaveRoleLabels = async (e) => {
    e.preventDefault();
    try {
      await updateRoleLabels(roleLabelsState);
      setMsg('Nombres de estatus guardados correctamente.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error guardando nombres de estatus: ' + err.message);
    }
  };

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
        durationDays: parseInt(ancDuration, 10) || 0,
        user
      });

      // Enviar a WhatsApp si está marcado
      if (ancWhatsApp) {
        const priorityLabel = ancPriority === 'URGENT' ? '🚨 *[AVISO URGENTE]*' : '📢 *[COMUNICADO OFICIAL]*';
        const waMsg = `${priorityLabel}\n*${ancTitle.trim()}*\n\n${ancContent.trim() ? ancContent.trim() + '\n\n' : ''}🔗 *Ver en la App:* https://war-calendario.web.app`;
        sendWhatsAppMessage(waMsg).catch(err => console.error("Error enviando WhatsApp del anuncio:", err));
      }

      setAncTitle('');
      setAncContent('');
      setAncPriority('NORMAL');
      setAncDuration('0');
      setAncWhatsApp(true);
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
    if (user && user.uid === targetUserId && newRoleValue !== ROLES.ADMIN) {
      alert("⚠️ No puedes quitarte a ti mismo el estatus de Administrador para evitar perder el acceso al panel.");
      return;
    }
    try {
      const numericRole = typeof newRoleValue === 'number' ? newRoleValue : parseInt(newRoleValue, 10);
      // Actualizacion optimista del estado local para respuesta UI instantanea
      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: numericRole } : u));
      await setDoc(doc(db, 'users', targetUserId), { role: numericRole }, { merge: true });
      setMsg('✓ Estatus de usuario actualizado.');
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

  const handleDeleteUserPermanent = async (targetUid, targetName) => {
    if (user && user.uid === targetUid) {
      alert("No puedes darte de baja a ti mismo desde el panel.");
      return;
    }
    if (window.confirm(`⚠️ ¿Estás SEGURO de que deseas dar de baja PERMANENTEMENTE a "${targetName}"?\n\nEsta acción eliminará su cuenta de acceso y su perfil.`)) {
      try {
        await deleteDoc(doc(db, 'users', targetUid));
        await fetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUid })
        });
        setMsg(`✓ El usuario ${targetName} ha sido dado de baja permanentemente.`);
        setTimeout(() => setMsg(''), 4000);
      } catch (err) {
        console.error("Error al dar de baja usuario:", err);
        setMsg('Error dando de baja al usuario: ' + err.message);
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
          <h2 className="title" style={{ margin: 0, fontSize: '1.5rem' }}>Panel de Administración</h2>
          <button 
            className="btn btn-secondary" 
            style={{ 
              padding: '0.2rem 0.6rem', 
              fontSize: '1rem', 
              lineHeight: 1, 
              minWidth: '32px', 
              height: '32px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '4px' 
            }} 
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
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
            {/* Formulario para renombrar estatus / roles existentes */}
            <form onSubmit={handleSaveRoleLabels} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', padding: '1.2rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '1rem', color: 'var(--accent-primary)' }}>
                Renombrar Estatus / Roles del Sistema
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Personaliza los nombres de los 4 niveles de estatus que verán los socios en la plataforma:
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Estatus 0 (No socio):</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={roleLabelsState[ROLES.NO_SOCIO] || ''}
                    onChange={(e) => setRoleLabelsState({ ...roleLabelsState, [ROLES.NO_SOCIO]: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Estatus 1 (Semisocio):</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={roleLabelsState[ROLES.SEMISOCIO] || ''}
                    onChange={(e) => setRoleLabelsState({ ...roleLabelsState, [ROLES.SEMISOCIO]: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Estatus 2 (Socio):</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={roleLabelsState[ROLES.SOCIO] || ''}
                    onChange={(e) => setRoleLabelsState({ ...roleLabelsState, [ROLES.SOCIO]: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Estatus 9 (Admin):</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={roleLabelsState[ROLES.ADMIN] || ''}
                    onChange={(e) => setRoleLabelsState({ ...roleLabelsState, [ROLES.ADMIN]: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
                Guardar
              </button>
            </form>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Lista de Socios y Asignación de Estatus</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {users.map((u) => (
                <div key={u.id} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{u.displayName || u.email}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estatus:</label>
                    <select 
                      className="form-input" 
                      style={{ padding: '0.4rem', width: 'auto', opacity: (user && user.uid === u.id) ? 0.7 : 1 }}
                      value={normalizeRole(u.role)}
                      disabled={user && user.uid === u.id}
                      title={user && user.uid === u.id ? "Tu cuenta principal de Administrador" : "Cambiar estatus"}
                      onChange={(e) => handleRoleChange(u.id, parseInt(e.target.value, 10))}
                    >
                      <option value={ROLES.NO_SOCIO}>{roleLabelsState[ROLES.NO_SOCIO]}</option>
                      <option value={ROLES.SEMISOCIO}>{roleLabelsState[ROLES.SEMISOCIO]}</option>
                      <option value={ROLES.SOCIO}>{roleLabelsState[ROLES.SOCIO]}</option>
                      <option value={ROLES.ADMIN}>{roleLabelsState[ROLES.ADMIN]}</option>
                    </select>
                    {(!user || user.uid !== u.id) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUserPermanent(u.id, u.displayName || u.email)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#f87171',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginLeft: '0.2rem'
                        }}
                        title="Eliminar usuario permanentemente de la plataforma y de Firebase Auth"
                      >
                        Dar de baja
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Limpieza */}
        {activeTab === 'cleaning' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Configuración del Cuadrante Rotativo</h3>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                onClick={() => setIsHistoryModalOpen(true)}
              >
                📜 Consultar Histórico de Limpiezas
              </button>
            </div>
            
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
                      {m.isManual && (
                        <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '6px' }}>(Manual)</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button 
                        className="btn btn-success" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.73rem' }} 
                        onClick={() => handleAdminMarkComplete(m)}
                        title="Marcar y registrar limpieza completada para este socio"
                      >
                        ✓ Validar Limpieza
                      </button>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fijar durante:</label>
                    <select 
                      className="form-input" 
                      style={{ padding: '0.3rem 0.6rem', width: 'auto' }}
                      value={ancDuration}
                      onChange={(e) => setAncDuration(e.target.value)}
                    >
                      <option value="0">Indefinido (Hasta eliminar)</option>
                      <option value="1">1 día</option>
                      <option value="3">3 días</option>
                      <option value="7">7 días</option>
                      <option value="14">14 días</option>
                      <option value="30">30 días</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', width: '100%', cursor: 'pointer' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox"
                      style={{ width: '1.2rem', height: '1.2rem', accentColor: '#25D366', cursor: 'pointer' }}
                      checked={ancWhatsApp}
                      onChange={(e) => setAncWhatsApp(e.target.checked)}
                    />
                    <span>📲 Enviar notificación al grupo de Avisos de WhatsApp</span>
                  </label>
                </div>

                <button type="submit" className="btn" style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem', marginTop: '0.4rem' }}>
                  + Publicar Anuncio
                </button>
              </div>
            </form>

            {/* Listado de anuncios publicados */}
            <h4 style={{ fontSize: '1rem', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>Anuncios Publicados ({announcements.length})</h4>

            {announcements.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay anuncios publicados. Crea el primero arriba.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {announcements.map(a => (
                  <div key={a.id} className="booking-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{a.title}</span>
                        {a.priority === 'URGENT' && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Urgente
                          </span>
                        )}
                        {a.durationDays > 0 ? (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '1px 6px', borderRadius: '4px' }}>
                            Fijado {a.durationDays} día(s)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: '4px' }}>
                            Indefinido
                          </span>
                        )}
                      </div>
                      {a.content && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0', whiteSpace: 'pre-wrap' }}>
                          {a.content}
                        </p>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                        Publicado por {a.createdBy || 'Admin'}
                      </div>
                    </div>
                    <button 
                      className="btn" 
                      style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#ffffff', padding: '0.35rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer' }}
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

            {/* Sección Mantenimiento de Reservas */}
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.6rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🗑️ Mantenimiento y Purga de Reservas
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Borra reservas masivamente por mes cuando realices pruebas o cambies la configuración de salas:
              </p>

              <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1.2rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Seleccionar Mes:</label>
                  <select 
                    className="form-input" 
                    style={{ padding: '0.4rem', width: 'auto' }}
                    value={purgeMonth}
                    onChange={(e) => setPurgeMonth(e.target.value)}
                  >
                    {monthOptions.map(m => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                  <select 
                    className="form-input" 
                    style={{ padding: '0.4rem', width: 'auto' }}
                    value={purgeYear}
                    onChange={(e) => setPurgeYear(e.target.value)}
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>

                  <button 
                    className="btn" 
                    style={{ background: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.8rem', padding: '0.45rem 0.9rem', color: '#ffffff', fontWeight: 'bold' }}
                    onClick={handlePurgeMonthBookings}
                  >
                    Borrar Reservas del Mes
                  </button>
                </div>

                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    ¿Necesitas vaciar el calendario por completo?
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={handlePurgeAllBookings}
                  >
                    Vaciar Todo el Calendario
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CleaningHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
      />
    </div>
  );
}
