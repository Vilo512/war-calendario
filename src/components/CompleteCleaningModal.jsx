import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminRole } from '../utils/roleUtils';
import { recordCleaningHistory } from '../services/cleaningHistoryService';
import { formatWeekRange, calculateAssigneeForDate } from '../utils/cleaningUtils';
import { sendCleaningCompletedNotification } from '../services/whatsappService';

export default function CompleteCleaningModal({ isOpen, onClose, weekId, user, userRole }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [weekData, setWeekData] = useState(null);
  const [assignee, setAssignee] = useState(null);
  const [formattedRange, setFormattedRange] = useState('');
  const [cleaningChatId, setCleaningChatId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !weekId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    async function loadWeekDetails() {
      try {
        // 1. Obtener documento de la semana
        const weekSnap = await getDoc(doc(db, 'cleaning_schedule', weekId));
        const wData = weekSnap.exists() ? weekSnap.data() : null;
        if (isMounted) setWeekData(wData);

        // 2. Obtener config global para determinar asignado por rotación si no hay override
        const configSnap = await getDoc(doc(db, 'cleaning_schedule', 'config'));
        const configData = configSnap.exists() ? configSnap.data() : { members: [] };

        let currentAssignee = null;
        if (wData && wData.assigneeName) {
          currentAssignee = {
            id: wData.assigneeId,
            name: wData.assigneeName,
            isManual: wData.isManual || false
          };
        } else if (configData.members && configData.members.length > 0) {
          const startDate = configData.startDate?.toDate ? configData.startDate.toDate() : (configData.startDate ? new Date(configData.startDate) : new Date());
          // Parsear weekId (ej: "2026-10-05")
          const [y, m, d] = weekId.split('-').map(Number);
          const weekDate = new Date(y, m - 1, d);
          const result = calculateAssigneeForDate(configData.members, startDate, weekDate);
          if (result) currentAssignee = result.assignee;
        }

        if (isMounted) {
          setAssignee(currentAssignee);
          setCleaningChatId(configData?.cleaningChatId || null);
          const [y, m, d] = weekId.split('-').map(Number);
          setFormattedRange(formatWeekRange(new Date(y, m - 1, d)));
          setLoading(false);
        }
      } catch (err) {
        console.error('Error al cargar datos de limpieza para verificación:', err);
        if (isMounted) {
          setErrorMsg('No se pudieron cargar los datos de la semana.');
          setLoading(false);
        }
      }
    }

    loadWeekDetails();
    return () => { isMounted = false; };
  }, [isOpen, weekId]);

  if (!isOpen) return null;

  const userId = user?.uid || user?.id;
  const isAdmin = isAdminRole(userRole);
  const isAssignee = Boolean(
    assignee && user && (
      assignee.id === userId ||
      assignee.name === user.displayName ||
      assignee.name === user.email
    )
  );

  const canComplete = Boolean(isAssignee || isAdmin);

  const handleConfirmCompletion = async () => {
    if (!canComplete) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const isCompletedByAdmin = isAdmin && !isAssignee;
      const completedByName = isCompletedByAdmin
        ? `Finalizado por Admin: ${user?.displayName || user?.email || 'Admin'}`
        : (user?.displayName || user?.email || 'Socio');

      const completedRole = isCompletedByAdmin ? 'admin' : 'assignee';

      // 1. Guardar estado en el documento de semana
      await setDoc(doc(db, 'cleaning_schedule', weekId), {
        completed: true,
        completedBy: completedByName,
        completedByRole: completedRole,
        completedAt: serverTimestamp(),
        weekRange: formattedRange || weekId
      }, { merge: true });

      // 2. Registrar en el historial de limpieza
      if (assignee) {
        await recordCleaningHistory({
          weekId: weekId,
          weekRange: formattedRange || weekId,
          memberId: assignee.id || 'manual',
          memberName: assignee.name || 'Socio',
          isManual: Boolean(assignee.isManual || assignee.type === 'manual'),
          completedByUid: userId || 'unknown',
          completedByName: completedByName
        });
      }

      // 3. Enviar aviso de limpieza completada al grupo de WhatsApp
      sendCleaningCompletedNotification({
        assigneeName: assignee?.name || 'Socio',
        completedByName: completedByName,
        weekRange: formattedRange || weekId,
        cleaningChatId: cleaningChatId
      }).catch(err => console.warn('Error enviando WhatsApp de finalización:', err));

      setSuccessMsg(isCompletedByAdmin 
        ? 'Limpieza validada con éxito como Administrador.' 
        : '¡Tu turno de limpieza ha sido registrado como completado con éxito!'
      );

      // Limpiar parámetros de la URL sin recargar
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.error('Error al finalizar turno de limpieza:', err);
      setErrorMsg('Ocurrió un error al guardar la finalización: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '1.8rem',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        background: '#18181b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative'
      }}>
        {/* Cabecera del modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* SVG Escoba / Limpieza */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
              <path d="m5 2 5 5"/>
              <path d="M2 13h10"/>
              <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
            </svg>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Finalización de Turno de Limpieza</h3>
          </div>
          <button
            onClick={handleModalClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.2rem'
            }}
            title="Cerrar"
          >
            {/* SVG Cruz */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Verificando permisos y turno...
          </div>
        ) : !user ? (
          /* Usuario no autenticado */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Debes iniciar sesión con tu cuenta de socio o administrador para registrar la finalización de este turno.
            </p>
            <button className="btn" onClick={handleModalClose}>
              Ir a Iniciar Sesión
            </button>
          </div>
        ) : successMsg ? (
          /* Estado de éxito */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h4 style={{ color: '#10b981', margin: '0 0 0.5rem 0' }}>¡Completado con Éxito!</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{successMsg}</p>
            <button className="btn" onClick={handleModalClose}>
              Aceptar y Cerrar
            </button>
          </div>
        ) : weekData?.completed ? (
          /* Ya completada previamente */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Turno Ya Finalizado</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Este turno de limpieza ({formattedRange}) ya fue registrado como completado previamente.
            </p>
            {weekData.completedBy && (
              <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.5rem' }}>
                Registrado por: <strong>{weekData.completedBy}</strong>
              </p>
            )}
            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={handleModalClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : !canComplete ? (
          /* Acceso Denegado: ni asignado ni admin */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Permiso Denegado</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.8rem' }}>
              Solo el socio que tiene asignado este turno o un Administrador tienen autorización para marcarlo como finalizado.
            </p>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.8rem', borderRadius: '6px', textAlign: 'left', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              <div><strong>Semana:</strong> {formattedRange}</div>
              <div><strong>Socio Asignado:</strong> {assignee?.name || 'No determinado'}</div>
              <div><strong>Tu Usuario:</strong> {user?.displayName || user?.email}</div>
            </div>
            <button className="btn btn-secondary" onClick={handleModalClose}>
              Entendido
            </button>
          </div>
        ) : (
          /* Formulario de confirmación */
          <div>
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Semana:</span> <strong>{formattedRange}</strong>
              </div>
              <div style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Socio asignado:</span> <strong>{assignee?.name || 'Socio'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Tu rol:</span>{' '}
                <span style={{ color: isAdmin ? '#818cf8' : '#10b981', fontWeight: 'bold' }}>
                  {isAdmin && !isAssignee ? 'Administrador (Validando turno de socio)' : 'Socio Asignado'}
                </span>
              </div>
            </div>

            {isAdmin && !isAssignee && (
              <p style={{ fontSize: '0.82rem', color: '#f59e0b', marginBottom: '1rem' }}>
                Al confirmar como Administrador, la limpieza quedará registrada en el histórico con la etiqueta "Finalizado por Admin: {user?.displayName || user?.email}".
              </p>
            )}

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button className="btn btn-secondary" onClick={handleModalClose} disabled={submitting}>
                Cancelar
              </button>
              <button className="btn btn-success" onClick={handleConfirmCompletion} disabled={submitting}>
                {submitting ? 'Guardando...' : (isAdmin && !isAssignee ? 'Validar como Admin' : 'Confirmar Limpieza Finalizada')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
