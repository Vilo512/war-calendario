import React, { useState } from 'react';
import { getWeekId, formatWeekRange, calculateCurrentAssignee } from '../utils/cleaningUtils';
import { createSwapRequest } from '../services/cleaningSwapService';

export default function SwapModal({ isOpen, onClose, user, members = [], startDate, weeksMap = {} }) {
  const [selectedMyWeek, setSelectedMyWeek] = useState('');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('');
  const [selectedTargetWeek, setSelectedTargetWeek] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const currentUserId = user?.uid || user?.id;
  const currentUserName = user?.displayName || user?.email;

  // Calcular las próximas 10 semanas para determinar quién tiene asignada cada semana
  const upcomingWeeks = [];
  const now = new Date();
  const currentInfo = calculateCurrentAssignee(members, startDate);

  if (members.length > 0 && currentInfo) {
    for (let i = 0; i < 10; i++) {
      const targetDate = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weekId = getWeekId(targetDate);
      const rangeStr = formatWeekRange(targetDate);

      // Verificar si hay un override en weeksMap
      let effectiveAssignee = null;
      if (weeksMap[weekId] && weeksMap[weekId].assigneeName) {
        effectiveAssignee = {
          id: weeksMap[weekId].assigneeId,
          name: weeksMap[weekId].assigneeName,
          isSwap: true
        };
      } else {
        const targetIndex = (currentInfo.index + i) % members.length;
        const defaultMember = members[targetIndex];
        if (defaultMember) {
          effectiveAssignee = {
            id: defaultMember.uid || defaultMember.id,
            name: defaultMember.name,
            isManual: defaultMember.isManual
          };
        }
      }

      if (effectiveAssignee) {
        upcomingWeeks.push({
          weekId,
          rangeStr,
          assignee: effectiveAssignee
        });
      }
    }
  }

  // 1. Mis semanas asignadas en el futuro próximo
  const myWeeks = upcomingWeeks.filter(w => 
    w.assignee.id === currentUserId || 
    w.assignee.name === currentUserName ||
    w.assignee.name === user?.email
  );

  // 2. Otros socios registrados que están en el cuadrante (excluir manuales y a mí mismo)
  const targetMembers = members.filter(m => 
    !m.isManual && 
    m.id !== currentUserId && 
    m.uid !== currentUserId && 
    m.name !== currentUserName &&
    m.name !== user?.email
  );

  // 3. Semanas asignadas al socio seleccionado
  const selectedTargetUser = targetMembers.find(m => (m.uid || m.id) === selectedTargetUserId);
  const targetUserWeeks = selectedTargetUserId ? upcomingWeeks.filter(w => 
    w.assignee.id === selectedTargetUserId || 
    w.assignee.name === selectedTargetUser?.name
  ) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedMyWeek) {
      setErrorMsg('Debes seleccionar una de tus semanas para permutar.');
      return;
    }
    if (!selectedTargetUserId) {
      setErrorMsg('Debes seleccionar al socio con quien quieres permutar.');
      return;
    }
    if (!selectedTargetWeek) {
      setErrorMsg('Debes seleccionar la semana del otro socio que deseas tomar.');
      return;
    }

    const myWeekObj = upcomingWeeks.find(w => w.weekId === selectedMyWeek);
    const targetWeekObj = upcomingWeeks.find(w => w.weekId === selectedTargetWeek);

    try {
      setLoading(true);
      await createSwapRequest({
        requesterUser: user,
        requesterWeekId: myWeekObj.weekId,
        requesterWeekRange: myWeekObj.rangeStr,
        targetUser: {
          id: selectedTargetUserId,
          name: selectedTargetUser?.name
        },
        targetWeekId: targetWeekObj.weekId,
        targetWeekRange: targetWeekObj.rangeStr
      });

      setSuccessMsg('¡Solicitud de permuta enviada con éxito!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Error creando solicitud de permuta:", err);
      setErrorMsg('Error al enviar solicitud: ' + err.message);
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '1.8rem', border: '1px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 className="title" style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔄</span> Solicitar Permuta de Limpieza
          </h3>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
          Intercambia una de tus semanas de limpieza asignadas con otro socio registrado.
        </p>

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
          {/* 1. Seleccionar mi semana */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              1. Tu semana a ceder:
            </label>
            {myWeeks.length === 0 ? (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>
                No tienes turnos de limpieza asignados en las próximas 10 semanas.
              </p>
            ) : (
              <select 
                className="form-input" 
                value={selectedMyWeek}
                onChange={(e) => setSelectedMyWeek(e.target.value)}
              >
                <option value="">-- Selecciona tu semana --</option>
                {myWeeks.map(w => (
                  <option key={w.weekId} value={w.weekId}>
                    {w.rangeStr}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Seleccionar socio */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              2. Socio con quien permutar:
            </label>
            <select 
              className="form-input"
              value={selectedTargetUserId}
              onChange={(e) => {
                setSelectedTargetUserId(e.target.value);
                setSelectedTargetWeek('');
              }}
              disabled={myWeeks.length === 0}
            >
              <option value="">-- Selecciona un socio --</option>
              {targetMembers.map(m => (
                <option key={m.id || m.uid} value={m.uid || m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Seleccionar semana deseada del socio */}
          {selectedTargetUserId && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                3. Semana deseada de {selectedTargetUser?.name}:
              </label>
              {targetUserWeeks.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                  Este socio no tiene semanas asignadas próximamente.
                </p>
              ) : (
                <select 
                  className="form-input"
                  value={selectedTargetWeek}
                  onChange={(e) => setSelectedTargetWeek(e.target.value)}
                >
                  <option value="">-- Selecciona su semana --</option>
                  {targetUserWeeks.map(w => (
                    <option key={w.weekId} value={w.weekId}>
                      {w.rangeStr}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !selectedMyWeek || !selectedTargetWeek}
            >
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
