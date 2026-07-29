import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminRole } from '../utils/roleUtils';
import { editWhatsAppMessage, buildWhatsAppMessageText } from '../services/whatsappService';

export default function AttendeesModal({ isOpen, onClose, booking, user, userRole, onToggleAttendance }) {
  if (!isOpen || !booking) return null;

  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [selectedUserUid, setSelectedUserUid] = useState('');
  const [manualGuestName, setManualGuestName] = useState('');
  const [isEditingOrganizer, setIsEditingOrganizer] = useState(false);
  const [selectedNewOrganizerUid, setSelectedNewOrganizerUid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = isAdminRole(userRole);
  const isOrganizer = user && (user.uid === booking.userId || user.email === booking.userEmail);
  const canManage = isAdmin || isOrganizer;

  const attendees = booking.attendees || [];
  const isAttending = user && attendees.some(a => a.uid === user.uid);
  const maxCount = booking.maxAttendees || null;
  const isFull = maxCount && attendees.length >= maxCount;

  // Cargar la lista de usuarios registrados cuando se abre el modal y se tienen permisos de gestión
  useEffect(() => {
    if (!isOpen || !canManage) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = [];
      snapshot.forEach(docSnap => uList.push({ id: docSnap.id, ...docSnap.data() }));
      setRegisteredUsers(uList);
    });
    return () => unsub();
  }, [isOpen, canManage]);

  const formatDisplayDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return String(dateStr);
  };

  const renderTimeRange = () => {
    if (booking.fullTimeRange) {
      return booking.fullTimeRange;
    }
    if (booking.startTime && booking.endTime) {
      return `${booking.startTime} - ${booking.endTime}`;
    }
    return booking.time || 'Horario no especificado';
  };

  // Helper para actualizar documentos en Firestore (soporta reservas trasnoche vinculadas)
  const updateBookingFirestoreData = async (updatePayload, updatedAttendees = null) => {
    setSubmitting(true);
    try {
      let targetIds = [booking.id];
      if (booking.overnightGroupId) {
        const q = query(collection(db, 'bookings'), where('overnightGroupId', '==', booking.overnightGroupId));
        const snap = await getDocs(q);
        targetIds = snap.docs.map(d => d.id);
      }

      await Promise.all(targetIds.map(id => updateDoc(doc(db, 'bookings', id), updatePayload)));

      // Editar aviso de WhatsApp únicamente si el evento fue anunciado previamente
      if (booking.whatsapp_sent && booking.whatsapp_message_id) {
        const attendeesForMsg = updatedAttendees !== null ? updatedAttendees : (booking.attendees || []);
        const updatedBookingObj = { ...booking, ...updatePayload, attendees: attendeesForMsg };
        const msgText = buildWhatsAppMessageText(updatedBookingObj);
        editWhatsAppMessage(booking.whatsapp_message_id, msgText).catch(e => console.error("Error editando mensaje en WhatsApp:", e));
      }
    } catch (err) {
      console.error("Error al actualizar la reserva:", err);
      alert("Error al guardar los cambios en la reserva.");
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar un asistente de la lista (Organizador / Admin)
  const handleRemoveAttendee = async (attToRemove) => {
    if (!canManage) return;
    if (window.confirm(`¿Estás seguro de quitar a "${attToRemove.name}" de la lista?`)) {
      const newAttendees = attendees.filter(a => {
        if (attToRemove.uid && a.uid) return a.uid !== attToRemove.uid;
        return a.name.toLowerCase() !== attToRemove.name.toLowerCase();
      });
      await updateBookingFirestoreData({ attendees: newAttendees }, newAttendees);
    }
  };

  // Añadir un usuario registrado como asistente
  const handleAddRegisteredUser = async () => {
    if (!selectedUserUid) return;
    const targetUser = registeredUsers.find(u => u.id === selectedUserUid);
    if (!targetUser) return;

    if (attendees.some(a => a.uid === targetUser.id)) {
      alert("Este socio ya está añadido en la lista de asistentes.");
      return;
    }

    const newAttendee = {
      uid: targetUser.id,
      name: targetUser.displayName || targetUser.email || 'Socio',
      isManual: false
    };

    const newAttendees = [...attendees, newAttendee];
    setSelectedUserUid('');
    await updateBookingFirestoreData({ attendees: newAttendees }, newAttendees);
  };

  // Añadir un invitado manual sin app
  const handleAddManualGuest = async () => {
    if (!manualGuestName.trim()) return;
    const trimmed = manualGuestName.trim();

    if (attendees.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Ya existe un participante con ese nombre en la lista.");
      return;
    }

    const newAttendee = {
      uid: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      isManual: true
    };

    const newAttendees = [...attendees, newAttendee];
    setManualGuestName('');
    await updateBookingFirestoreData({ attendees: newAttendees }, newAttendees);
  };

  // Cambiar organizador (Solo Administradores)
  const handleChangeOrganizer = async () => {
    if (!isAdmin || !selectedNewOrganizerUid) return;
    const targetUser = registeredUsers.find(u => u.id === selectedNewOrganizerUid);
    if (!targetUser) return;

    const newName = targetUser.displayName || targetUser.email || 'Socio';
    if (window.confirm(`¿Cambiar el organizador del evento a "${newName}"?`)) {
      const updatePayload = {
        userId: targetUser.id,
        userEmail: targetUser.email || '',
        userName: newName
      };

      setIsEditingOrganizer(false);
      setSelectedNewOrganizerUid('');
      await updateBookingFirestoreData(updatePayload);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 12, 0.92)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '1.8rem', border: '1px solid var(--accent-primary)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Cabecera del modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 className="title" style={{ margin: 0, fontSize: '1.3rem' }}>{booking.name}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span>Sala: {booking.room}</span> |
              <span>Fecha: {formatDisplayDateDMY(booking.date)}</span> |
              <span>Horario: {renderTimeRange()}</span>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        {/* Bloque Organizador con reasignación por Admins */}
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.8rem', borderRadius: '6px', marginBottom: '1.2rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Organizador / Reservado por: </span>
            <strong style={{ color: '#ffffff' }}>{booking.userName || booking.userEmail || 'Socio'}</strong>
          </div>
          {isAdmin && (
            <button 
              className="btn btn-secondary" 
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setIsEditingOrganizer(!isEditingOrganizer)}
            >
              {isEditingOrganizer ? 'Cancelar' : '✏️ Cambiar Organizador'}
            </button>
          )}
        </div>

        {/* Panel desplegable para cambiar organizador (Admins) */}
        {isAdmin && isEditingOrganizer && (
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--accent-primary)', padding: '0.8rem', borderRadius: '6px', marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem', color: '#c4b5fd' }}>
              Reasignar propiedad de la reserva a otro socio:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="form-input" 
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.4rem' }}
                value={selectedNewOrganizerUid}
                onChange={e => setSelectedNewOrganizerUid(e.target.value)}
              >
                <option value="">-- Seleccionar nuevo organizador --</option>
                {registeredUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                ))}
              </select>
              <button 
                className="btn" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                disabled={!selectedNewOrganizerUid || submitting}
                onClick={handleChangeOrganizer}
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* Barra de progreso de aforo */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 'bold' }}>Asistentes Confirmados</span>
            <span style={{ color: isFull ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
              {attendees.length}{maxCount ? ` / ${maxCount} plazas` : ' (Sin límite de plazas)'}
            </span>
          </div>
          {maxCount && (
            <div style={{ background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                background: isFull ? 'var(--danger)' : 'var(--success)',
                width: `${Math.min(100, (attendees.length / maxCount) * 100)}%`,
                height: '100%',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          )}
        </div>

        {/* Lista detallada de asistentes con botón de eliminación para Organizador y Admins */}
        <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
          {attendees.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', margin: '1rem 0' }}>
              Aún no se ha apuntado nadie a esta actividad. ¡Sé el primero en unirte!
            </p>
          ) : (
            attendees.map((att, idx) => (
              <div key={att.uid || idx} className="booking-item" style={{ padding: '0.5rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>#{idx + 1}</span>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{att.name}</span>
                  {att.isManual && (
                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '4px' }}>
                      Invitado
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {att.uid === user?.uid && (
                    <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      Tú
                    </span>
                  )}
                  {canManage && (
                    <button 
                      title="Eliminar participante"
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 5px' }}
                      onClick={() => handleRemoveAttendee(att)}
                      disabled={submitting}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Módulo de Inclusión Manual / Selección de Socios (Organizador & Admins) */}
        {canManage && (
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed var(--border-light)', borderRadius: '6px', padding: '0.9rem', marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.6rem', color: 'var(--accent-secondary)' }}>
              ➕ Añadir Participante (Organizador / Admin)
            </label>
            
            {/* Opción A: Seleccionar Socio Registrado */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <select 
                className="form-input"
                style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem' }}
                value={selectedUserUid}
                onChange={e => setSelectedUserUid(e.target.value)}
              >
                <option value="">-- Añadir socio registrado --</option>
                {registeredUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                ))}
              </select>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.7rem' }}
                disabled={!selectedUserUid || submitting}
                onClick={handleAddRegisteredUser}
              >
                + Añadir
              </button>
            </div>

            {/* Opción B: Añadir Invitado Manual sin App */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Nombre de invitado sin app..."
                style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem' }}
                value={manualGuestName}
                onChange={e => setManualGuestName(e.target.value)}
              />
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.7rem' }}
                disabled={!manualGuestName.trim() || submitting}
                onClick={handleAddManualGuest}
              >
                + Invitado
              </button>
            </div>
          </div>
        )}

        {/* Acciones del pie */}
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          {user && (
            <button 
              className={isAttending ? "btn btn-secondary" : "btn"}
              style={{
                background: isAttending ? 'rgba(239, 68, 68, 0.2)' : undefined,
                color: isAttending ? 'var(--danger)' : undefined,
                borderColor: isAttending ? 'var(--danger)' : undefined,
                opacity: (!isAttending && isFull) ? 0.6 : 1,
                cursor: (!isAttending && isFull) ? 'not-allowed' : 'pointer'
              }}
              disabled={!isAttending && isFull}
              onClick={() => {
                onToggleAttendance(booking);
              }}
            >
              {isAttending ? '✓ Desapuntarme' : (isFull ? 'Lleno' : '+ Apuntarme')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
