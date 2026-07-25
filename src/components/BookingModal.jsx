import React, { useState, useEffect } from 'react';
import { doc, runTransaction, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { canBook as canBookUser, getRoleLabel } from '../utils/roleUtils';

export default function BookingModal({ isOpen, onClose, user, userRole, initialDate, initialRoom }) {
  const [formData, setFormData] = useState({ 
    name: '', 
    room: '', 
    date: '', 
    startTime: '10:00', 
    endTime: '12:00', 
    maxAttendees: '' 
  });
  const [roomsList, setRoomsList] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const defaultRooms = ['Estudio A', 'Estudio B', 'Sala Conferencias'];

  // Cargar lista de salas dinámicas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach(d => rList.push(d.data().name));
      const listToUse = rList.length > 0 ? rList : defaultRooms;
      setRoomsList(listToUse);
    });
    return () => unsub();
  }, []);

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

  // Inicializar o resetear el formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetDate = initialDate ? initialDate : todayStr;
      const targetRoom = initialRoom ? initialRoom : (roomsList[0] || 'Estudio A');

      setFormData({
        name: '',
        room: targetRoom,
        date: targetDate,
        startTime: '10:00',
        endTime: '12:00',
        maxAttendees: ''
      });
      setErrorMsg('');
    }
  }, [isOpen, initialDate, initialRoom, roomsList]);

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
      endMin = startMin + 60; // 1 hora por defecto si es registro legado
    }

    return { startMin, endMin };
  };

  // Detectar conflictos de solapamiento de horario para la misma fecha y sala
  const currentRoom = formData.room || (roomsList[0] || 'Estudio A');
  const currentStartMin = timeToMinutes(formData.startTime);
  const currentEndMin = timeToMinutes(formData.endTime);

  const conflicts = existingBookings.filter(b => {
    if (b.date !== formData.date || b.room !== currentRoom) return false;
    
    const { startMin, endMin } = getBookingTimeRangeInMinutes(b);
    
    // Hay solapamiento si: nuevoInicio < existenteFin Y nuevoFin > existenteInicio
    return currentStartMin < endMin && currentEndMin > startMin;
  });

  const hasConflict = conflicts.length > 0;
  const isTimeOrderInvalid = currentEndMin <= currentStartMin;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!userCanBook) {
      setErrorMsg('Debes tener el estatus de Socio o Administrador para crear reservas.');
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
    // Document ID determinista con fecha, sala y rango horario
    const bookingId = `${selectedRoom.replace(/\s+/g, '_')}_${formData.date}_${formData.startTime.replace(':', '-')}_${formData.endTime.replace(':', '-')}`;
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
          userId: user ? user.uid : 'anonymous',
          userEmail: user ? user.email : '',
          userName: user ? (user.displayName || user.email) : 'Anónimo',
          createdAt: new Date()
        });
      });
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
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>Nueva Reserva</h2>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        {!userCanBook ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>
              Tu estatus actual es <strong>"{getRoleLabel(userRole)}"</strong>. Solamente los miembros con estatus de <strong>Socio</strong> o <strong>Administrador</strong> pueden realizar reservas de estudios.
            </p>
            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Entendido</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nombre del Evento / Actividad</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej. Partida de Catán / Warhammer / Retrato" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Sala / Estudio</label>
              <select 
                className="form-input"
                value={formData.room || (roomsList[0] || 'Estudio A')}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              >
                {roomsList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Fecha de la Reserva</label>
              <input 
                type="date" 
                className="form-input" 
                style={{ width: '100%' }}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

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

            {/* Alerta dinámica de Solapamiento / Conflicto en rojo */}
            {hasConflict && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: '6px', padding: '0.8rem', marginBottom: '1rem' }}>
                <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>⚠️</span> Conflicto de Horario Detectado
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
                ⚠️ La hora de fin debe ser posterior a la hora de inicio.
              </div>
            )}

            <div className="form-group">
              <label>Límite de Asistentes / Plazas (Opcional)</label>
              <input 
                type="number" 
                min="1"
                max="100"
                className="form-input" 
                placeholder="Ej. 4 (dejar vacío si no hay límite)" 
                value={formData.maxAttendees}
                onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
              />
            </div>
            
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
                {submitting ? 'Guardando...' : 'Confirmar Reserva'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
