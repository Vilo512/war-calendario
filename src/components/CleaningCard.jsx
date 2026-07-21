import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatWeekRange, getWeekId, calculateCurrentAssignee } from '../utils/cleaningUtils';

export default function CleaningCard({ user, userRole }) {
  const [config, setConfig] = useState(null);
  const [weekDoc, setWeekDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);

  const weekId = getWeekId();
  const weekRange = formatWeekRange();

  // Escuchar configuración global de limpieza
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'cleaning_schedule', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      } else {
        setConfig({ members: [], startDate: new Date() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Escuchar estado de la semana actual
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'cleaning_schedule', weekId), (docSnap) => {
      if (docSnap.exists()) {
        setWeekDoc(docSnap.data());
      } else {
        setWeekDoc(null);
      }
    });
    return () => unsub();
  }, [weekId]);

  // Solo socios y administradores ven la tarjeta de limpieza
  if (userRole !== 'socio' && userRole !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Cargando turno de limpieza...
      </div>
    );
  }

  const members = config?.members || [];
  const startDate = config?.startDate?.toDate ? config.startDate.toDate() : (config?.startDate ? new Date(config.startDate) : new Date());

  const currentInfo = calculateCurrentAssignee(members, startDate);
  const assignee = currentInfo?.assignee;
  const isCompleted = weekDoc?.completed || false;

  const isAdmin = userRole === 'admin';
  const isMyTurn = assignee && user && (assignee.id === user.uid || assignee.name === user.displayName || assignee.name === user.email);
  const canComplete = isMyTurn || isAdmin;

  // Calcular semanas restantes para el turno del usuario logueado
  let userWeeksLeft = null;
  if (user && members.length > 0) {
    const myIndex = members.findIndex(m => m.id === user.uid || m.name === user.displayName || m.name === user.email);
    if (myIndex !== -1 && currentInfo) {
      const diff = myIndex - currentInfo.index;
      userWeeksLeft = diff >= 0 ? diff : members.length + diff;
    }
  }

  // Marcar como completado
  const handleToggleComplete = async (status) => {
    try {
      await setDoc(doc(db, 'cleaning_schedule', weekId), {
        completed: status,
        completedBy: status ? (user?.displayName || user?.email || 'Anónimo') : null,
        completedAt: status ? new Date() : null,
        weekRange: weekRange
      }, { merge: true });
    } catch (err) {
      console.error("Error al actualizar limpieza:", err);
      alert("Error al actualizar el estado de limpieza.");
    }
  };

  // Es domingo y no se ha completado?
  const isSunday = new Date().getDay() === 0;
  const isUrgentWarning = isSunday && !isCompleted;

  // Generar lista de próximos turnos para el desplegable
  const upcomingWeeks = [];
  if (members.length > 0 && currentInfo) {
    const totalWeeksToShow = Math.max(members.length, 6);
    const now = new Date();
    for (let i = 0; i < totalWeeksToShow; i++) {
      const targetDate = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const targetIndex = (currentInfo.index + i) % members.length;
      const targetAssignee = members[targetIndex];
      const isMe = user && targetAssignee && (targetAssignee.id === user.uid || targetAssignee.name === user.displayName || targetAssignee.name === user.email);

      upcomingWeeks.push({
        weekNum: i,
        rangeStr: formatWeekRange(targetDate),
        assigneeName: targetAssignee ? targetAssignee.name : 'Sin asignar',
        isMe: isMe,
        isCurrent: i === 0
      });
    }
  }

  return (
    <div className="glass-panel cleaning-card" style={{ borderLeft: isCompleted ? '4px solid var(--success)' : (isUrgentWarning ? '4px solid var(--danger)' : '4px solid var(--accent-primary)') }}>
      <div className="cleaning-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="cleaning-icon" style={{ background: isCompleted ? 'rgba(16, 185, 129, 0.2)' : undefined, color: isCompleted ? 'var(--success)' : undefined }}>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Turno de Limpieza</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{weekRange}</p>
          </div>
        </div>
        <div>
          {isCompleted ? (
            <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              ✓ Completada
            </span>
          ) : isUrgentWarning ? (
            <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              ⚠️ ¡Último día!
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '12px' }}>
              En progreso
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        {members.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            El cuadrante de limpieza está vacío. Un Administrador debe configurar la lista de socios desde el Panel de Admin.
          </p>
        ) : (
          <>
            <p style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0' }}>
              Responsable esta semana: <strong style={{ color: 'var(--accent-primary)', fontSize: '1.05rem' }}>{assignee ? assignee.name : 'Sin asignar'}</strong>
            </p>
            {isMyTurn && !isCompleted && (
              <p style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
                👉 ¡Es tu turno de limpiar el local esta semana!
              </p>
            )}
            {userWeeksLeft !== null && !isMyTurn && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>
                {userWeeksLeft === 0 ? 'Te toca esta semana' : `Te tocará en ${userWeeksLeft} semana(s)`}
              </p>
            )}
          </>
        )}
      </div>

      {isCompleted ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Limpiado por: {weekDoc?.completedBy || 'Socio'}
          </span>
          {canComplete && (
            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleToggleComplete(false)}>
              Desmarcar
            </button>
          )}
        </div>
      ) : (
        canComplete && members.length > 0 && (
          <button className="btn btn-success" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={() => handleToggleComplete(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Marcar Turno Como Completado
          </button>
        )
      )}

      {/* Botón desplegable para consultar calendario de turnos futuros */}
      {members.length > 0 && (
        <div style={{ marginTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.8rem' }}>
          <button 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--accent-primary)', 
              fontSize: '0.85rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justify: 'space-between',
              width: '100%',
              padding: 0
            }}
            onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
          >
            <span>📅 {showScheduleDropdown ? 'Ocultar Próximos Turnos' : '¿Cuándo me toca? (Ver Turnos Futuros)'}</span>
            <span>{showScheduleDropdown ? '▲' : '▼'}</span>
          </button>

          {showScheduleDropdown && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              {upcomingWeeks.map((item, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    justify: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.4rem 0.6rem', 
                    borderRadius: '6px',
                    background: item.isMe ? 'rgba(99, 102, 241, 0.25)' : (item.isCurrent ? 'rgba(255,255,255,0.05)' : 'transparent'),
                    border: item.isMe ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    fontSize: '0.8rem'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>{item.rangeStr}:</span>
                    <strong style={{ color: item.isMe ? 'var(--accent-primary)' : 'inherit' }}>{item.assigneeName}</strong>
                  </div>
                  {item.isMe && (
                    <span style={{ background: 'var(--accent-primary)', color: 'white', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      ¡Tu Turno!
                    </span>
                  )}
                  {item.isCurrent && !item.isMe && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                      (Esta semana)
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
