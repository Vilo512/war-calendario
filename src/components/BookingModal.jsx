import React, { useState, useEffect } from 'react';
import { doc, runTransaction, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function BookingModal({ isOpen, onClose, user, userRole }) {
  const [formData, setFormData] = useState({ name: '', room: '', date: '', time: '' });
  const [roomsList, setRoomsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const defaultRooms = ['Estudio A', 'Estudio B', 'Sala Conferencias'];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach(d => rList.push(d.data().name));
      if (rList.length > 0) {
        setRoomsList(rList);
        setFormData(prev => ({ ...prev, room: prev.room || rList[0] }));
      } else {
        setRoomsList(defaultRooms);
        setFormData(prev => ({ ...prev, room: prev.room || defaultRooms[0] }));
      }
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const canBook = userRole === 'socio' || userRole === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!canBook) {
      setErrorMsg('Debes tener el estatus de Socio o Administrador para crear reservas.');
      return;
    }

    // Normalizar ID de documento para la sala y hora seleccionadas
    const selectedRoom = formData.room || (roomsList[0] || 'Estudio A');
    const bookingId = `${selectedRoom.replace(/\s+/g, '_')}_${formData.date}_${formData.time.replace(':', '-')}`;
    const bookingRef = doc(db, 'bookings', bookingId);

    setSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const bookingDoc = await transaction.get(bookingRef);
        if (bookingDoc.exists()) {
          throw new Error('Esta sala ya está reservada a esa hora.');
        }
        transaction.set(bookingRef, {
          ...formData,
          room: selectedRoom,
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
        <h2 className="title" style={{fontSize: '1.5rem'}}>Nueva Reserva</h2>
        
        {!canBook ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>
              Tu estatus actual es <strong>"{userRole || 'No socio'}"</strong>. Solamente los miembros con estatus de <strong>Socio</strong> o <strong>Administrador</strong> pueden realizar reservas de estudios.
            </p>
            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Entendido</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nombre del Evento</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej. Partida de Warhammer / Pintura" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Sala / Estudio</label>
              <select 
                className="form-input"
                value={formData.room || (roomsList[0] || 'Estudio A')}
                onChange={(e) => setFormData({...formData, room: e.target.value})}
              >
                {roomsList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{display: 'flex', gap: '1rem', flexDirection: 'row'}}>
              <div style={{flex: 1}}>
                <label>Fecha</label>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{width: '100%'}}
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div style={{flex: 1}}>
                <label>Hora</label>
                <input 
                  type="time" 
                  className="form-input" 
                  style={{width: '100%'}}
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  required
                />
              </div>
            </div>
            
            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: '1rem', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{flex: 1}}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={submitting} style={{flex: 1}}>
                {submitting ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
