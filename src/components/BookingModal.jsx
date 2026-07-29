import React, { useState, useEffect } from 'react';
import { doc, runTransaction, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { canBook as canBookUser, getRoleLabel } from '../utils/roleUtils';
import { sendWhatsAppMessage } from '../services/whatsappService';

export default function BookingModal({ 
  isOpen, 
  onClose, 
  user, 
  userRole, 
  initialDate, 
  initialRoom,
  duplicateBookingData = null
}) {
  const [formData, setFormData] = useState({ 
    name: '', 
    room: '', 
    date: '', 
    startTime: '10:00', 
    endTime: '12:00', 
    maxAttendees: '',
    activityType: 'open',       // 'open' (Abierta) | 'closed' (Cerrada/Privada)
    targetAudience: 'publico',   // 'publico' | 'semisocios' | 'socios'
    announceOnWhatsApp: true     // Activado por defecto para facilitar avisos
  });
  const [roomsList, setRoomsList] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [preAttendees, setPreAttendees] = useState([]);
  const [selectedUserUid, setSelectedUserUid] = useState('');
  const [manualGuestName, setManualGuestName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cargar lista de salas dinámicas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach(d => rList.push(d.data().name));
      setRoomsList(rList);
    });
    return () => unsub();
  }, []);

  // Cargar lista de usuarios registrados para el selector de pre-apuntados
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = [];
      snapshot.forEach(docSnap => uList.push({ id: docSnap.id, ...docSnap.data() }));
      setRegisteredUsers(uList);
    });
    return () => unsub();
  }, [isOpen]);

  // Cargar todas las reservas para la detección en vivo de conflictos
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const bList = [];
      snapshot.forEach(d => bList.push({ id: d.id, ...d.data() }));
      setExistingBookings(bList);
    });
    return () => unsub();
  }, [isOpen]);

  // Inicializar o resetear el formulario cuando se abre el modal (soporta duplicado)
  useEffect(() => {
    if (isOpen) {
      if (duplicateBookingData) {
        setFormData({
          name: duplicateBookingData.name ? `${duplicateBookingData.name} (Copia)` : '',
          room: initialRoom || duplicateBookingData.room || (roomsList[0] || ''),
          date: initialDate || duplicateBookingData.date || new Date().toISOString().split('T')[0],
          startTime: duplicateBookingData.startTime || '10:00',
          endTime: duplicateBookingData.endTime || '12:00',
          maxAttendees: duplicateBookingData.maxAttendees || '',
          activityType: duplicateBookingData.activityType || 'open',
          targetAudience: duplicateBookingData.targetAudience || 'publico',
          announceOnWhatsApp: true
        });
        setPreAttendees(duplicateBookingData.attendees || []);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        const targetDate = initialDate ? initialDate : todayStr;
        const targetRoom = initialRoom ? initialRoom : (roomsList[0] || '');

        setFormData({
          name: '',
          room: targetRoom,
          date: targetDate,
          startTime: '10:00',
          endTime: '12:00',
          maxAttendees: '',
          activityType: 'open',
          targetAudience: 'publico',
          announceOnWhatsApp: true
        });
        setPreAttendees([]);
      }
      setSelectedUserUid('');
      setManualGuestName('');
      setErrorMsg('');
    }
  }, [isOpen, initialDate, initialRoom, duplicateBookingData, roomsList]);

  if (!isOpen) return null;

  const userCanBook = canBookUser(userRole);

  // Helper para convertir "HH:MM" a minutos desde medianoche
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  // Helper para obtener rango [inicio, fin] en minutos de una reserva existente
  const getBookingTimeRangeInMinutes = (b) => {
    let startMin = 0;
    let endMin = 1440; // 24h

    if (b.startTime && b.endTime) {
      startMin = timeToMinutes(b.startTime);
      endMin = timeToMinutes(b.endTime);
    } else if (b.time && b.time.includes('-')) {
      const parts = b.time.split('-');
      startMin = timeToMinutes(parts[0]);
      endMin = timeToMinutes(parts[1]);
    } else if (b.time) {
      startMin = timeToMinutes(b.time);
      endMin = startMin + 60;
    }

    return { startMin, endMin };
  };

  // Detectar conflictos de solapamiento de horario para la misma fecha y sala
  const currentRoom = formData.room || (roomsList[0] || '');
  const currentStartMin = timeToMinutes(formData.startTime);
  const currentEndMin = timeToMinutes(formData.endTime);

  const conflicts = existingBookings.filter(b => {
    if (b.date !== formData.date || b.room !== currentRoom) return false;
    const { startMin, endMin } = getBookingTimeRangeInMinutes(b);
    return currentStartMin < endMin && currentEndMin > startMin;
  });

  const hasConflict = conflicts.length > 0;
  const isTimeOrderInvalid = currentEndMin <= currentStartMin;

  // Añadir un usuario registrado a la lista de pre-apuntados
  const handleAddRegisteredPreAttendee = () => {
    if (!selectedUserUid) return;
    const targetUser = registeredUsers.find(u => u.id === selectedUserUid);
    if (!targetUser) return;

    if (preAttendees.some(a => a.uid === targetUser.id)) {
      alert("Este socio ya está añadido en la lista de asistentes.");
      return;
    }

    setPreAttendees(prev => [...prev, {
      uid: targetUser.id,
      name: targetUser.displayName || targetUser.email,
      isManual: false
    }]);
    setSelectedUserUid('');
  };

  // Añadir un participante manual / invitado sin app
  const handleAddManualPreAttendee = () => {
    if (!manualGuestName.trim()) return;
    const trimmed = manualGuestName.trim();
    if (preAttendees.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Ya existe un participante con ese nombre en la lista.");
      return;
    }

    setPreAttendees(prev => [...prev, {
      uid: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      isManual: true
    }]);
    setManualGuestName('');
  };

  const handleRemovePreAttendee = (uidToRemove) => {
    setPreAttendees(prev => prev.filter(a => a.uid !== uidToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!userCanBook) {
      setErrorMsg('Debes tener el estatus de Socio o Administrador para crear reservas.');
      return;
    }

    if (!currentRoom) {
      setErrorMsg('Debes seleccionar o crear una sala primero.');
      return;
    }

    if (isTimeOrderInvalid) {
      setErrorMsg('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    if (hasConflict) {
      const conflict = conflicts[0];
      const timeDisplay = conflict.startTime && conflict.endTime ? `${conflict.startTime} - ${conflict.endTime}` : (conflict.time || 'esa hora');
      setErrorMsg(`Conflicto de horario: La sala "${currentRoom}" ya está ocupada por "${conflict.name}" (${timeDisplay}).`);
      return;
    }

    const selectedRoom = currentRoom;
    const formattedTime = `${formData.startTime} - ${formData.endTime}`;
    const bookingId = `${selectedRoom.replace(/\s+/g, '_')}_${formData.date}_${formData.startTime.replace(':', '-')}_${formData.endTime.replace(':', '-')}_${Date.now()}`;
    const bookingRef = doc(db, 'bookings', bookingId);

    const parsedMax = formData.maxAttendees ? parseInt(formData.maxAttendees, 10) : null;

    setSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const bookingDoc = await transaction.get(bookingRef);
        if (bookingDoc.exists()) {
          throw new Error('Esta sala ya está reservada en ese horario exacto.');
        }
        transaction.set(bookingRef, {
          name: formData.name.trim(),
          room: selectedRoom,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          time: formattedTime,
          maxAttendees: parsedMax,
          activityType: formData.activityType || 'open',
          targetAudience: formData.targetAudience || 'publico',
          attendees: preAttendees,
          userId: user ? user.uid : 'anonymous',
          userEmail: user ? user.email : '',
          userName: user ? (user.displayName || user.email) : 'Anónimo',
          createdAt: new Date(),
          whatsapp_sent: formData.announceOnWhatsApp ? true : false // Se marcará como true ya que lo enviaremos ahora
        });
      });
      
      // Enviar notificación a WhatsApp de forma asíncrona (fire and forget)
      if (formData.announceOnWhatsApp) {
        const msg = `📢 *${formData.name.trim()}*\n📅 *${formData.date}* - ⏰ *${formData.startTime}* a *${formData.endTime}*\n📍 *${selectedRoom}*\n👥 *${parsedMax ? parsedMax + ' plazas' : 'Sin límite'}*\n🔗 *Apúntate en la App:* https://war-calendario.web.app`;
        
        sendWhatsAppMessage(msg).catch(err => console.error("Error enviando WhatsApp:", err));
      }

      onClose();
    } catch (error) {
      console.error("Error al reservar: ", error);
      setErrorMsg(error.message || 'Error al guardar la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 className="title" style={{ fontSize: '1.4rem', margin: 0 }}>
            {duplicateBookingData ? '📑 Duplicar / Clonar Reserva' : 'Nueva Reserva'}
          </h2>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        {!userCanBook ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>
              Tu estatus actual es <strong>"{getRoleLabel(userRole)}"</strong>. Solamente los miembros con estatus de <strong>Socio</strong> o <strong>Administrador</strong> pueden realizar reservas.
            </p>
            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Entendido</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Nombre del evento */}
            <div className="form-group">
              <label>Nombre de la Actividad / Partida</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej. Partida de Rol D&D / Warhammer / Retrato" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Sala y Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
              <div className="form-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                <label>Sala / Estudio</label>
                <select 
                  className="form-input"
                  value={currentRoom}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                >
                  {roomsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                <label>Fecha de la Reserva</label>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Horario inicio / fin */}
            <div className="form-group" style={{ display: 'flex', gap: '1rem', flexDirection: 'row' }}>
              <div style={{ flex: 1 }}>
                <label>Hora Inicio</label>
                <input 
                  type="time" 
                  className="form-input" 
                  style={{ width: '100%' }}
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Hora Fin</label>
                <input 
                  type="time" 
                  className="form-input" 
                  style={{ width: '100%' }}
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Configuración Bloque 4: Tipo de Actividad & Público Objetivo (Apilados verticalmente a Full Width para evitar overflow) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem', width: '100%', boxSizing: 'border-box' }}>
              <h4 style={{ margin: '0 0 0.9rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⚙️ Ajustes de Asistencia y Accesibilidad
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', width: '100%', boxSizing: 'border-box' }}>
                {/* Tipo de Actividad (Abierta vs Cerrada) */}
                <div className="form-group" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block', color: 'var(--text-secondary)' }}>
                    Modalidad de Plaza
                  </label>
                  <select 
                    className="form-input"
                    value={formData.activityType}
                    onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem', fontSize: '0.9rem' }}
                  >
                    <option value="open">🔓 Abierta (Cualquiera puede unirse)</option>
                    <option value="closed">🔒 Cerrada / Privada (Mesa reservada)</option>
                  </select>
                </div>

                {/* Público Objetivo */}
                <div className="form-group" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block', color: 'var(--text-secondary)' }}>
                    Público Objetivo
                  </label>
                  <select 
                    className="form-input"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem', fontSize: '0.9rem' }}
                  >
                    <option value="publico">🌐 Público General (Todos)</option>
                    <option value="semisocios">🤝 Socios y Simpatizantes</option>
                    <option value="socios">⭐ Exclusivo para Socios</option>
                  </select>
                </div>

                {/* Toggle WhatsApp */}
                <div className="form-group" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox"
                      style={{ width: '1.2rem', height: '1.2rem', accentColor: '#25D366', cursor: 'pointer' }}
                      checked={formData.announceOnWhatsApp}
                      onChange={(e) => setFormData({ ...formData, announceOnWhatsApp: e.target.checked })}
                    />
                    <span>📢 Anunciar en el grupo de WhatsApp de la Asociación</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Límite de plazas */}
            <div className="form-group">
              <label>Aforo Máximo / Límite de Plazas (Opcional)</label>
              <input 
                type="number" 
                min="1"
                max="100"
                className="form-input" 
                placeholder="Ej. 6 (dejar vacío si no hay límite)" 
                value={formData.maxAttendees}
                onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
              />
            </div>

            {/* Bloque 4: Pre-apuntados (Asistentes Iniciales) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#ffffff' }}>
                  👥 Pre-apuntados / Asistentes Iniciales ({preAttendees.length})
                </h4>
              </div>

              {/* Controles para añadir socio app o invitado manual */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '0.8rem', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                  <select 
                    className="form-input"
                    style={{ flex: '1 1 180px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    value={selectedUserUid}
                    onChange={(e) => setSelectedUserUid(e.target.value)}
                  >
                    <option value="">-- Seleccionar Socio de la App --</option>
                    {registeredUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={handleAddRegisteredPreAttendee}
                  >
                    + Añadir Socio
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ flex: '1 1 180px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    placeholder="O escribe nombre de invitado manual (sin app)..." 
                    value={manualGuestName}
                    onChange={(e) => setManualGuestName(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={handleAddManualPreAttendee}
                  >
                    + Invitado
                  </button>
                </div>
              </div>

              {/* Lista de pre-apuntados agregados */}
              {preAttendees.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
                  {preAttendees.map(att => (
                    <span 
                      key={att.uid} 
                      style={{ 
                        background: att.isManual ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: att.isManual ? '1px solid #f59e0b' : '1px solid #10b981',
                        color: att.isManual ? '#f59e0b' : '#34d399',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <span>{att.name} {att.isManual ? '(Invitado)' : ''}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemovePreAttendee(att.uid)}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Alerta dinámica de Conflicto */}
            {hasConflict && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: '6px', padding: '0.8rem', marginBottom: '1rem' }}>
                <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  ⚠️ Conflicto de Horario Detectado
                </div>
                {conflicts.map(c => {
                  const rangeDisplay = c.startTime && c.endTime ? `${c.startTime} - ${c.endTime}` : (c.time || '');
                  return (
                    <p key={c.id} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0 }}>
                      La sala <strong>"{currentRoom}"</strong> ya está ocupada por <strong>"{c.name}"</strong> de <strong>{rangeDisplay}</strong>.
                    </p>
                  );
                })}
              </div>
            )}

            {isTimeOrderInvalid && !hasConflict && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
                La hora de fin debe ser posterior a la hora de inicio.
              </div>
            )}

            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn" 
                disabled={submitting || hasConflict || isTimeOrderInvalid} 
                style={{ flex: 1, opacity: (hasConflict || isTimeOrderInvalid) ? 0.5 : 1 }}
              >
                {submitting ? 'Guardando...' : (duplicateBookingData ? 'Confirmar Reserva Clonada' : 'Confirmar Reserva')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
