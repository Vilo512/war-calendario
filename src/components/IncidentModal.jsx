import React, { useState } from 'react';
import { createIncident, INCIDENT_TYPES } from '../services/cleaningIncidentService';

export default function IncidentModal({ isOpen, onClose, user, weekId, weekRange, assignedMemberName }) {
  const [selectedType, setSelectedType] = useState('NOT_DONE');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      setLoading(true);
      await createIncident({
        weekId,
        weekRange,
        assignedMemberName,
        reporterUser: user,
        type: selectedType,
        description
      });

      setSuccessMsg('⚠️ Incidencia reportada al Administrador.');
      setTimeout(() => {
        setSuccessMsg('');
        setDescription('');
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Error al crear incidencia:", err);
      setErrorMsg('Error al reportar incidencia: ' + err.message);
    } finally {
      setLoading(false);
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '1.8rem', border: '1px solid var(--danger)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 className="title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Reportar Incidencia de Limpieza
          </h3>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '6px', marginBottom: '1.2rem', fontSize: '0.85rem' }}>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Semana:</strong> {weekRange}</div>
          <div><strong style={{ color: 'var(--text-secondary)' }}>Responsable Asignado:</strong> {assignedMemberName || 'Sin asignar'}</div>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              Motivo de la incidencia:
            </label>
            <select 
              className="form-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {Object.keys(INCIDENT_TYPES).map(key => (
                <option key={key} value={key}>{INCIDENT_TYPES[key]}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              Detalles / Observaciones (opcional):
            </label>
            <textarea 
              className="form-input" 
              rows="3" 
              placeholder="Ej: El suelo no se barrió y las papeleras estaban llenas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn" 
              style={{ background: 'var(--danger)', color: 'white' }}
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
