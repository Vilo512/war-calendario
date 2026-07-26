import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatWeekRange, getWeekId, calculateCurrentAssignee } from '../utils/cleaningUtils';
import { isCleaningMember, isAdminRole } from '../utils/roleUtils';
import { 
  subscribeUserSwaps, 
  subscribeAllWeeks, 
  acceptSwapRequest, 
  rejectSwapRequest, 
  cancelSwapRequest 
} from '../services/cleaningSwapService';
import SwapModal from './SwapModal';
import IncidentModal from './IncidentModal';
import CleaningHistoryModal from './CleaningHistoryModal';
import { recordCleaningHistory, removeCleaningHistoryForWeek } from '../services/cleaningHistoryService';

export default function CleaningCard({ user, userRole }) {
  const [config, setConfig] = useState(null);
  const [weekDoc, setWeekDoc] = useState(null);
  const [weeksMap, setWeeksMap] = useState({});
  const [userSwaps, setUserSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const weekId = getWeekId();
  const weekRange = formatWeekRange();
  const userId = user?.uid || user?.id;

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

  // Escuchar mapa completo de semanas (para overrides por permuta)
  useEffect(() => {
    const unsub = subscribeAllWeeks((map) => {
      setWeeksMap(map);
    });
    return () => unsub();
  }, []);

  // Escuchar permutas del usuario actual
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeUserSwaps(userId, (swaps) => {
      setUserSwaps(swaps);
    });
    return () => unsub();
  }, [userId]);

  // Solo socios y administradores ven la tarjeta de limpieza
  if (!isCleaningMember(userRole)) {
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

  // Determinar asignado efectivo de esta semana (considerando override por permuta)
  const defaultInfo = calculateCurrentAssignee(members, startDate);
  const currentWeekOverride = weeksMap[weekId];
  
  let assignee = null;
  let isSwapTurn = false;
  let originalAssigneeName = null;

  if (currentWeekOverride && currentWeekOverride.assigneeName) {
    assignee = {
      id: currentWeekOverride.assigneeId,
      name: currentWeekOverride.assigneeName,
      isManual: currentWeekOverride.isManual || false
    };
    isSwapTurn = currentWeekOverride.isSwap || false;
    originalAssigneeName = currentWeekOverride.originalAssigneeName;
  } else if (defaultInfo) {
    assignee = defaultInfo.assignee;
  }

  const isCompleted = weekDoc?.completed || false;
  const isAdmin = isAdminRole(userRole);
  const isMyTurn = assignee && user && (assignee.id === userId || assignee.name === user.displayName || assignee.name === user.email);
  const canComplete = isMyTurn || isAdmin;

  // Calcular semanas restantes para el turno del usuario logueado en la rotación por defecto
  let userWeeksLeft = null;
  if (user && members.length > 0) {
    const myIndex = members.findIndex(m => m.id === userId || m.name === user.displayName || m.name === user.email);
    if (myIndex !== -1 && defaultInfo) {
      const diff = myIndex - defaultInfo.index;
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

      if (status && assignee) {
        await recordCleaningHistory({
          weekId: weekId,
          weekRange: weekRange,
          memberId: assignee.id || 'manual',
          memberName: assignee.name || 'Socio',
          isManual: Boolean(assignee.isManual || assignee.type === 'manual'),
          completedByUid: user?.uid || 'system',
          completedByName: user?.displayName || user?.email || 'Socio'
        });
      } else if (!status) {
        await removeCleaningHistoryForWeek(weekId);
      }
    } catch (err) {
      console.error("Error al actualizar limpieza:", err);
      alert("Error al actualizar el estado de limpieza.");
    }
  };

  // Acciones sobre permutas / cambios
  const handleAcceptSwap = async (swap) => {
    try {
      await acceptSwapRequest(swap);
      setActionMsg('¡Cambio de turno aceptado con éxito!');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      console.error("Error al aceptar cambio:", err);
      alert('Error al aceptar cambio: ' + err.message);
    }
  };

  const handleRejectSwap = async (swapId) => {
    try {
      await rejectSwapRequest(swapId);
      setActionMsg('Solicitud de cambio rechazada.');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      console.error("Error al rechazar cambio:", err);
    }
  };

  const handleCancelSwap = async (swapId) => {
    try {
      await cancelSwapRequest(swapId);
      setActionMsg('Solicitud cancelada.');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      console.error("Error al cancelar permuta:", err);
    }
  };

  const isSunday = new Date().getDay() === 0;
  const isUrgentWarning = isSunday && !isCompleted;

  // Filtrar solicitudes de permuta pendientes
  const pendingIncomingSwaps = userSwaps.filter(s => s.targetId === userId && s.status === 'PENDING');
  const pendingOutgoingSwaps = userSwaps.filter(s => s.requesterId === userId && s.status === 'PENDING');

  // Generar lista de próximos turnos para el desplegable (tomando en cuenta overrides)
  const upcomingWeeks = [];
  if (members.length > 0 && defaultInfo) {
    const totalWeeksToShow = Math.max(members.length, 6);
    const now = new Date();
    for (let i = 0; i < totalWeeksToShow; i++) {
      const targetDate = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const targetWeekId = getWeekId(targetDate);
      const rangeStr = formatWeekRange(targetDate);

      let itemAssigneeName = 'Sin asignar';
      let itemIsMe = false;
      let itemIsSwap = false;

      const override = weeksMap[targetWeekId];
      if (override && override.assigneeName) {
        itemAssigneeName = override.assigneeName;
        itemIsMe = user && (override.assigneeId === userId || override.assigneeName === user.displayName || override.assigneeName === user.email);
        itemIsSwap = override.isSwap || false;
      } else {
        const targetIndex = (defaultInfo.index + i) % members.length;
        const targetAssignee = members[targetIndex];
        itemAssigneeName = targetAssignee ? targetAssignee.name : 'Sin asignar';
        itemIsMe = user && targetAssignee && (targetAssignee.id === userId || targetAssignee.name === user.displayName || targetAssignee.name === user.email);
      }

      upcomingWeeks.push({
        weekNum: i,
        rangeStr: rangeStr,
        assigneeName: itemAssigneeName,
        isMe: itemIsMe,
        isSwap: itemIsSwap,
        isCurrent: i === 0
      });
    }
  }

  return (
    <div className="glass-panel cleaning-card" style={{ borderLeft: isCompleted ? '4px solid var(--success)' : (isUrgentWarning ? '4px solid var(--danger)' : '4px solid var(--accent-primary)') }}>
      {/* Cabecera */}
      <div className="cleaning-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="cleaning-icon" style={{ background: isCompleted ? 'rgba(16, 185, 129, 0.2)' : undefined, color: isCompleted ? 'var(--success)' : undefined }}>
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 4 3 3L7 19l-3 1 1-3L16 4z"></path>
              <path d="m14 6 3 3"></path>
              <path d="M4 20h4"></path>
              <circle cx="18" cy="18" r="2"></circle>
              <circle cx="20" cy="14" r="1.5"></circle>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Turno de Limpieza</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{weekRange}</p>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {isCompleted ? (
            <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              ✓ Completada
            </span>
          ) : isUrgentWarning ? (
            <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.25)', color: 'var(--danger)', padding: '3px 8px', borderRadius: '12px', fontWeight: '800', whiteSpace: 'nowrap', border: '1px solid var(--danger)' }}>
              ⚠️ ¡Último día!
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
              En progreso
            </span>
          )}
        </div>
      </div>

      {actionMsg && (
        <div style={{ marginTop: '0.8rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}>
          {actionMsg}
        </div>
      )}

      {/* Alertas de Permutas Entrantes */}
      {pendingIncomingSwaps.length > 0 && (
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pendingIncomingSwaps.map(swap => (
            <div key={swap.id} style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Solicitud de Cambio Recibida
              </div>
              <p style={{ fontSize: '0.8rem', margin: '0 0 0.6rem 0', color: 'var(--text-primary)' }}>
                <strong>{swap.requesterName}</strong> desea intercambiar su semana (<strong>{swap.requesterWeekRange}</strong>) por tu semana (<strong>{swap.targetWeekRange}</strong>).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-success" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleAcceptSwap(swap)}>
                  ✓ Aceptar Cambio
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }} onClick={() => handleRejectSwap(swap.id)}>
                  × Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas de Permutas Salientes */}
      {pendingOutgoingSwaps.length > 0 && (
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pendingOutgoingSwaps.map(swap => (
            <div key={swap.id} style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px dashed var(--accent-primary)', borderRadius: '6px', padding: '0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>Solicitud Enviada a {swap.targetName}:</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cambiar {swap.requesterWeekRange} por {swap.targetWeekRange}</div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => handleCancelSwap(swap.id)}>
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Información principal de la semana */}
      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        {members.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            El cuadrante de limpieza está vacío. Un Administrador debe configurar la lista de socios desde el Panel de Admin.
          </p>
        ) : (
          <>
            <div style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span>Responsable esta semana:</span>
              <strong style={{ color: 'var(--accent-primary)', fontSize: '1.05rem' }}>
                {assignee ? assignee.name : 'Sin asignar'}
              </strong>
              {isSwapTurn && (
                <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', border: '1px solid #f59e0b' }}>
                  Cambio (Original: {originalAssigneeName})
                </span>
              )}
            </div>
            {isMyTurn && !isCompleted && (
              <p style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
                ¡Es tu turno de limpiar el local esta semana!
              </p>
            )}
            {userWeeksLeft !== null && !isMyTurn && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>
                {userWeeksLeft === 0 ? 'Te toca esta semana' : `Te tocará en ~${userWeeksLeft} semana(s) por rotación`}
              </p>
            )}
          </>
        )}
      </div>

      {/* Botones de acción */}
      {isCompleted ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Limpiado por: {weekDoc?.completedBy || 'Socio'}
          </span>
          {canComplete && (
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleToggleComplete(false)}>
              Desmarcar
            </button>
          )}
        </div>
      ) : (
        canComplete && members.length > 0 && (
          <button 
            className="btn" 
            style={{ 
              width: '100%', 
              marginBottom: '0.6rem', 
              padding: '0.45rem 0.8rem', 
              fontSize: '0.82rem',
              background: 'rgba(6, 78, 59, 0.6)',
              color: '#34d399',
              border: '1px solid #059669',
              boxShadow: 'none'
            }} 
            onClick={() => handleToggleComplete(true)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Turno completado
          </button>
        )
      )}

      {/* Botones de acción secundaria (Cambio / Incidencia) adaptativos */}
      <div className="cleaning-actions-group">
        {members.length > 1 && (
          <button 
            className="btn btn-secondary" 
            style={{ flex: 1, padding: '0.45rem 0.5rem', fontSize: '0.78rem', whiteSpace: 'nowrap', justifyContent: 'center' }}
            onClick={() => setIsSwapModalOpen(true)}
          >
            Cambiar Turno
          </button>
        )}
        <button 
          className="btn btn-secondary" 
          style={{ flex: 1, padding: '0.45rem 0.5rem', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', whiteSpace: 'nowrap', justifyContent: 'center' }}
          onClick={() => setIsIncidentModalOpen(true)}
        >
          Reportar Incidencia
        </button>
      </div>

      {/* Desplegable de turnos futuros */}
      {members.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.8rem' }}>
          <button 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--accent-primary)', 
              fontSize: '0.85rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
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
                    justifyContent: 'space-between', 
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
                    {item.isSwap && (
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '4px' }}>(Permutado)</span>
                    )}
                  </div>
                  {item.isMe && (
                    <span style={{ background: '#ffffff', color: '#000000', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', border: '1px solid #ffffff' }}>
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

      {/* Botón de Histórico */}
      <button 
        className="btn btn-secondary" 
        style={{ width: '100%', marginTop: '0.8rem', padding: '0.45rem', fontSize: '0.8rem', justifyContent: 'center' }}
        onClick={() => setIsHistoryModalOpen(true)}
      >
        📜 Ver Histórico de Limpiezas
      </button>

      {/* Modales */}
      <SwapModal 
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        user={user}
        members={members}
        startDate={startDate}
        weeksMap={weeksMap}
      />

      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        user={user}
        weekId={weekId}
        weekRange={weekRange}
        assignedMemberName={assignee ? assignee.name : 'Sin asignar'}
      />

      <CleaningHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
}
