import React, { useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function BookingModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({ name: '', room: 'Estudio A', date: '', time: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(false);
    setErrorMsg('');
    
    // Normalizar ID de documento para la sala y hora seleccionadas
    const bookingId = `${formData.room.replace(/\s+/g, '_')}_${formData.date}_${formData.time.replace(':', '-')}`;
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
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre del Evento</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej. Sesión de fotos" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Sala / Estudio</label>
            <select 
              className="form-input"
              value={formData.room}
              onChange={(e) => setFormData({...formData, room: e.target.value})}
            >
              <option value="Estudio A">Estudio A</option>
              <option value="Estudio B">Estudio B</option>
              <option value="Sala Conferencias">Sala Conferencias</option>
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
      </div>
    </div>
  );
}
