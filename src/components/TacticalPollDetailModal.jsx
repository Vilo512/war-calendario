import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminRole, isSocio, ROLES } from '../utils/roleUtils';
import { editWhatsAppMessage, buildWhatsAppPollMessageText } from '../services/whatsappService';
import { findVideosInText, VideoEmbedPlayer, FormattedDescriptionText } from '../utils/linkUtils';
import { SLOT_PRESETS, GENERIC_DAYS, formatPollDateDMY } from './TacticalPollModal';

const QUICK_AVAILABILITY_TAGS = [
  'Lun-Jue Tarde',
  'Lun-Jue Noche',
  'Viernes Tarde',
  'Viernes Noche',
  'Sábado Mañana',
  'Sábado Tarde',
  'Sábado Noche',
  'Domingo Mañana',
  'Domingo Tarde'
];

export default function TacticalPollDetailModal({
  isOpen,
  onClose,
  poll,
  user,
  userRole,
  onConvertPollToBooking
}) {
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  // Estado para añadir nueva propuesta de horario
  const [showAddOptionForm, setShowAddOptionForm] = useState(false);
  const [optionMode, setOptionMode] = useState('date');
  const [optionDate, setOptionDate] = useState('');
  const [optionGenericDay, setOptionGenericDay] = useState('Sábado');
  const [optionSlotPreset, setOptionSlotPreset] = useState('afternoon');
  const [optionStartTime, setOptionStartTime] = useState('16:00');
  const [optionEndTime, setOptionEndTime] = useState('20:00');

  // Estado para disponibilidad libre del usuario actual
  const [myGeneralNote, setMyGeneralNote] = useState('');
  const [myTags, setMyTags] = useState([]);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  // Estado para añadir invitado manual / socio por organizador
  const [manualParticipantName, setManualParticipantName] = useState('');
  const [selectedSocioUid, setSelectedSocioUid] = useState('');
  const [targetOptionForManual, setTargetOptionForManual] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const isAdmin = isAdminRole(userRole);
  const isOrganizer = user && poll && (user.uid === poll.userId || user.email === poll.userEmail);
  const canManage = isAdmin || isOrganizer;

  useEffect(() => {
    if (!isOpen || !canManage) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = [];
      snapshot.forEach(docSnap => uList.push({ id: docSnap.id, ...docSnap.data() }));
      setRegisteredUsers(uList);
    });
    return () => unsub();
  }, [isOpen, canManage]);

  useEffect(() => {
    if (poll) {
      setEditedDescription(poll.description || '');
      setIsEditingDescription(false);
      const todayStr = new Date().toISOString().split('T')[0];
      setOptionDate(todayStr);

      const notes = poll.participantNotes || [];
      const mine = user ? notes.find(n => n.uid === user.uid) : null;
      setMyGeneralNote(mine ? (mine.generalAvailability || '') : '');
      setMyTags(mine ? (mine.tags || []) : []);

      const opts = poll.options || [];
      if (opts.length > 0 && !targetOptionForManual) {
        setTargetOptionForManual(opts[0].id);
      }
    }
  }, [poll, user]);

  if (!isOpen || !poll) return null;

  const options = poll.options || [];
  const participantNotes = poll.participantNotes || [];

  const checkAudienceAccess = () => {
    if (!user) return false;
    if (poll.targetAudience === 'socios' && !isSocio(userRole)) {
      alert('Este Sondeo Táctico es exclusivo para miembros con estatus de Socio o Administrador.');
      return false;
    }
    if (poll.targetAudience === 'semisocios' && (!userRole || userRole < ROLES.SEMISOCIO)) {
      alert('Este Sondeo Táctico requiere estatus de Simpatizante (semisocio) o Socio.');
      return false;
    }
    return true;
  };

  const syncPollUpdate = async (updatePayload) => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'tactical_polls', poll.id), updatePayload);
      const updatedPoll = { ...poll, ...updatePayload };
      if (updatedPoll.whatsapp_sent && updatedPoll.whatsapp_message_id) {
        const msg = buildWhatsAppPollMessageText(updatedPoll, poll.id);
        editWhatsAppMessage(updatedPoll.whatsapp_message_id, msg).catch(e =>
          console.error('Error editando mensaje de sondeo en WhatsApp:', e)
        );
      }
    } catch (err) {
      console.error('Error actualizando Sondeo Táctico:', err);
      alert('Error al guardar cambios en el Sondeo Táctico.');
    } finally {
      setSubmitting(false);
    }
  };

  // Votar en una opción: status 'yes' | 'if_needed' | null (quitar)
  const handleVoteOption = async (optionId, desiredStatus) => {
    if (!checkAudienceAccess()) return;
    const voterName = user.displayName || user.email || 'Socio';

    const updatedOptions = options.map(opt => {
      if (opt.id !== optionId) return opt;
      const currentVotes = opt.votes || [];
      const existingVote = currentVotes.find(v => v.uid === user.uid);

      let nextVotes;
      if (existingVote && existingVote.status === desiredStatus) {
        // Si pulsa el mismo botón, se desmarca
        nextVotes = currentVotes.filter(v => v.uid !== user.uid);
      } else if (existingVote) {
        nextVotes = currentVotes.map(v =>
          v.uid === user.uid ? { ...v, status: desiredStatus, name: voterName } : v
        );
      } else {
        nextVotes = [...currentVotes, { uid: user.uid, name: voterName, status: desiredStatus }];
      }

      return { ...opt, votes: nextVotes };
    });

    await syncPollUpdate({ options: updatedOptions });
  };

  // Proponer una nueva opción de fecha / franja horaria por cualquier participante
  const handleProposeNewOption = async () => {
    if (!checkAudienceAccess()) return;

    let baseLabel = '';
    let dateValue = '';

    if (optionMode === 'date') {
      if (!optionDate) {
        alert('Selecciona una fecha del calendario.');
        return;
      }
      dateValue = optionDate;
      baseLabel = formatPollDateDMY(optionDate);
    } else {
      baseLabel = optionGenericDay;
    }

    const presetObj = SLOT_PRESETS.find(p => p.id === optionSlotPreset);
    const slotLabel = presetObj ? presetObj.label : 'Horario';
    const voterName = user.displayName || user.email || 'Socio';

    const newOpt = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      mode: optionMode,
      date: dateValue,
      label: baseLabel,
      slotType: optionSlotPreset,
      slotLabel: slotLabel,
      startTime: optionStartTime || '16:00',
      endTime: optionEndTime || '20:00',
      createdByUid: user.uid,
      createdByName: voterName,
      votes: [{
        uid: user.uid,
        name: voterName,
        status: 'yes'
      }]
    };

    const isDup = options.some(
      o => o.label === newOpt.label && o.startTime === newOpt.startTime && o.endTime === newOpt.endTime
    );
    if (isDup) {
      alert('Esa opción de día y horario ya está en la lista. Puedes votarla directamente arriba.');
      return;
    }

    const updatedOptions = [...options, newOpt];
    await syncPollUpdate({ options: updatedOptions });
    setShowAddOptionForm(false);
  };

  // Eliminar una opción (solo creador de la opción, organizador o admin)
  const handleDeleteOption = async (optId) => {
    if (!window.confirm('¿Eliminar esta opción horaria del sondeo?')) return;
    const updatedOptions = options.filter(o => o.id !== optId);
    await syncPollUpdate({ options: updatedOptions });
  };

  // Guardar nota / etiquetas de disponibilidad general del usuario
  const handleSaveMyAvailability = async () => {
    if (!checkAudienceAccess()) return;
    const voterName = user.displayName || user.email || 'Socio';
    const cleanNote = myGeneralNote.trim();

    let nextNotes;
    if (!cleanNote && myTags.length === 0) {
      nextNotes = participantNotes.filter(n => n.uid !== user.uid);
    } else {
      const entry = {
        uid: user.uid,
        name: voterName,
        generalAvailability: cleanNote,
        tags: myTags,
        updatedAt: new Date().toISOString()
      };
      const exists = participantNotes.some(n => n.uid === user.uid);
      if (exists) {
        nextNotes = participantNotes.map(n => n.uid === user.uid ? entry : n);
      } else {
        nextNotes = [...participantNotes, entry];
      }
    }

    await syncPollUpdate({ participantNotes: nextNotes });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2200);
  };

  const handleToggleQuickTag = (tag) => {
    setMyTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Añadir socio o invitado manual a una opción (Organizador / Admin)
  const handleAddParticipantByManager = async (isManualGuest) => {
    if (!canManage) return;
    const targetOptId = targetOptionForManual || (options[0] && options[0].id);
    if (!targetOptId) {
      alert('Primero añade al menos una opción de fecha/horario para asignarle el participante.');
      return;
    }

    let newVoter = null;
    if (isManualGuest) {
      const trimmed = manualParticipantName.trim();
      if (!trimmed) return;
      newVoter = {
        uid: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmed,
        status: 'yes',
        isManual: true
      };
      setManualParticipantName('');
    } else {
      if (!selectedSocioUid) return;
      const found = registeredUsers.find(u => u.id === selectedSocioUid);
      if (!found) return;
      newVoter = {
        uid: found.id,
        name: found.displayName || found.email || 'Socio',
        status: 'yes',
        isManual: false
      };
      setSelectedSocioUid('');
    }

    const updatedOptions = options.map(opt => {
      if (opt.id !== targetOptId) return opt;
      const votes = opt.votes || [];
      if (votes.some(v => v.uid === newVoter.uid || v.name.toLowerCase() === newVoter.name.toLowerCase())) {
        return opt;
      }
      return { ...opt, votes: [...votes, newVoter] };
    });

    await syncPollUpdate({ options: updatedOptions });
  };

  // Quitar un votante de una opción (Organizador / Admin)
  const handleRemoveVoterFromOption = async (optId, voterUid) => {
    if (!canManage) return;
    const updatedOptions = options.map(opt => {
      if (opt.id !== optId) return opt;
      return {
        ...opt,
        votes: (opt.votes || []).filter(v => v.uid !== voterUid)
      };
    });
    await syncPollUpdate({ options: updatedOptions });
  };

  // Guardar descripción editada
  const handleSaveDescription = async () => {
    if (!canManage) return;
    await syncPollUpdate({ description: editedDescription.trim() });
    setIsEditingDescription(false);
  };

  // Eliminar sondeo completo
  const handleDeletePoll = async () => {
    if (!canManage) return;
    if (window.confirm('¿Estás seguro de eliminar este Sondeo Táctico del Tablón de Reclutamiento?')) {
      try {
        await deleteDoc(doc(db, 'tactical_polls', poll.id));
        onClose();
      } catch (err) {
        console.error('Error borrando Sondeo Táctico:', err);
        alert('No tienes permiso para borrar este sondeo.');
      }
    }
  };

  // Calcular cuál es el máximo de votos positivos para destacar la Opción Líder
  const maxYesVotes = options.reduce((max, o) => {
    const yesCount = (o.votes || []).filter(v => v.status === 'yes').length;
    return yesCount > max ? yesCount : max;
  }, 0);

  // Recopilar todos los participantes únicos del sondeo
  const getAllUniqueParticipants = (specificOption = null) => {
    const map = new Map();
    if (specificOption) {
      (specificOption.votes || []).forEach(v => {
        map.set(v.uid, {
          uid: v.uid,
          name: v.name,
          isManual: Boolean(v.isManual)
        });
      });
    } else {
      options.forEach(opt => {
        (opt.votes || []).forEach(v => {
          if (!map.has(v.uid)) {
            map.set(v.uid, { uid: v.uid, name: v.name, isManual: Boolean(v.isManual) });
          }
        });
      });
      participantNotes.forEach(n => {
        if (!map.has(n.uid)) {
          map.set(n.uid, { uid: n.uid, name: n.name, isManual: false });
        }
      });
    }
    // Asegurar que el organizador esté incluido si aún no estaba
    if (poll.userId && !map.has(poll.userId)) {
      map.set(poll.userId, {
        uid: poll.userId,
        name: poll.userName || poll.userEmail || 'Organizador',
        isManual: false
      });
    }
    return Array.from(map.values());
  };

  // Consolidar en Reserva Oficial
  const handleConfirmAndBook = (chosenOption = null) => {
    if (!canManage || !onConvertPollToBooking) return;
    const attendeesList = getAllUniqueParticipants(chosenOption);
    const todayStr = new Date().toISOString().split('T')[0];

    const bookingTemplate = {
      fromPollId: poll.id,
      confirmedOptionLabel: chosenOption ? `${chosenOption.label} (${chosenOption.startTime} - ${chosenOption.endTime})` : 'Acordado en Sondeo Táctico',
      name: poll.name,
      room: (poll.preferredRoom && poll.preferredRoom !== 'Cualquier sala disponible') ? poll.preferredRoom : '',
      date: (chosenOption && chosenOption.date) ? chosenOption.date : todayStr,
      startTime: (chosenOption && chosenOption.startTime) ? chosenOption.startTime : '16:00',
      endTime: (chosenOption && chosenOption.endTime) ? chosenOption.endTime : '20:00',
      maxAttendees: poll.maxAttendees || '',
      activityType: 'open',
      targetAudience: poll.targetAudience || 'publico',
      description: poll.description || '',
      attendees: attendeesList
    };

    onConvertPollToBooking(bookingTemplate);
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
      padding: '0.8rem'
    }} onClick={onClose}>
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '660px',
          padding: '1.5rem',
          border: '1px solid #10b981',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '0.9rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
              <span style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-stencil)',
                letterSpacing: '0.06em',
                background: poll.status === 'confirmed' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: poll.status === 'confirmed' ? '#60a5fa' : '#34d399',
                border: poll.status === 'confirmed' ? '1px solid #3b82f6' : '1px solid #10b981',
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                {poll.status === 'confirmed' ? 'Reserva Consolidada' : 'Sondeo Táctico Activo'}
              </span>
              {poll.targetAudience === 'socios' && (
                <span style={{ fontSize: '0.68rem', background: '#064e3b', color: '#34d399', border: '1px solid #10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  SOLO SOCIOS
                </span>
              )}
              {poll.targetAudience === 'semisocios' && (
                <span style={{ fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  SOCIOS Y SIMPATIZANTES
                </span>
              )}
            </div>

            <h3 className="title" style={{ margin: 0, fontSize: '1.35rem', lineHeight: 1.2 }}>{poll.name}</h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span>Organiza: <strong style={{ color: '#ffffff' }}>{poll.userName || 'Socio'}</strong></span>
              <span>|</span>
              <span>Sala pref.: <strong style={{ color: '#ffffff' }}>{poll.preferredRoom || 'Cualquiera'}</strong></span>
              {poll.maxAttendees && (
                <>
                  <span>|</span>
                  <span>Cupo: <strong style={{ color: '#34d399' }}>Máx. {poll.maxAttendees} jug.</strong></span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {canManage && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDeletePoll}
                style={{ padding: '0.3rem 0.55rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                title="Eliminar Sondeo Táctico"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.6rem' }}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Descripción y Recursos */}
        {(poll.description || canManage) && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '0.75rem 0.9rem',
            marginBottom: '1.1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (isEditingDescription || poll.description) ? '0.5rem' : 0 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>Briefing / Descripción y Recursos</span>
              </span>
              {canManage && !isEditingDescription && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.18rem 0.5rem' }}
                  onClick={() => {
                    setIsEditingDescription(true);
                    setEditedDescription(poll.description || '');
                  }}
                >
                  {poll.description ? 'Editar' : '+ Añadir Descripción'}
                </button>
              )}
            </div>

            {isEditingDescription ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  value={editedDescription}
                  onChange={e => setEditedDescription(e.target.value)}
                  placeholder="Añade detalles, reglas o enlaces de YouTube..."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem' }} onClick={() => setIsEditingDescription(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn" style={{ fontSize: '0.74rem', padding: '0.25rem 0.7rem' }} onClick={handleSaveDescription} disabled={submitting}>
                    Guardar
                  </button>
                </div>
              </div>
            ) : poll.description ? (
              <div>
                <FormattedDescriptionText text={poll.description} />
                {findVideosInText(poll.description).map((vid, idx) => (
                  <VideoEmbedPlayer key={vid.id || idx} video={vid} initialOpen={false} />
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* SECCIÓN 1: MATRIZ DE PROPUESTAS HORARIAS (DOODLE TÁCTICO) */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.7rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span>Opciones de Fecha y Franja Horaria ({options.length})</span>
            </h4>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.76rem', padding: '0.32rem 0.7rem', borderColor: '#10b981', color: '#34d399' }}
              onClick={() => setShowAddOptionForm(!showAddOptionForm)}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{showAddOptionForm ? 'Cerrar Formulario' : 'Proponer Fecha / Franja'}</span>
            </button>
          </div>

          {/* Formulario desplegable para que cualquier participante proponga una nueva opción */}
          {showAddOptionForm && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.07)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              padding: '0.9rem',
              marginBottom: '0.9rem'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', marginBottom: '0.6rem' }}>
                Añadir nueva propuesta de día y horario al sondeo:
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setOptionMode('date')}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: optionMode === 'date' ? '1px solid #ffffff' : '1px solid var(--border-light)',
                    background: optionMode === 'date' ? 'rgba(255,255,255,0.14)' : '#18181b',
                    color: optionMode === 'date' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  Fecha Concreta
                </button>
                <button
                  type="button"
                  onClick={() => setOptionMode('generic')}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: optionMode === 'generic' ? '1px solid #ffffff' : '1px solid var(--border-light)',
                    background: optionMode === 'generic' ? 'rgba(255,255,255,0.14)' : '#18181b',
                    color: optionMode === 'generic' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  Día Genérico (Viernes, Sábado...)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.6rem' }}>
                {optionMode === 'date' ? (
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                    value={optionDate}
                    onChange={e => setOptionDate(e.target.value)}
                  />
                ) : (
                  <select
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                    value={optionGenericDay}
                    onChange={e => setOptionGenericDay(e.target.value)}
                  >
                    {GENERIC_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}

                <select
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
                  value={optionSlotPreset}
                  onChange={e => {
                    const pid = e.target.value;
                    setOptionSlotPreset(pid);
                    const found = SLOT_PRESETS.find(p => p.id === pid);
                    if (found) {
                      setOptionStartTime(found.startTime);
                      setOptionEndTime(found.endTime);
                    }
                  }}
                >
                  {SLOT_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.label} ({p.startTime}-{p.endTime})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="time"
                  className="form-input"
                  style={{ flex: '1 1 90px', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                  value={optionStartTime}
                  onChange={e => setOptionStartTime(e.target.value)}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>a</span>
                <input
                  type="time"
                  className="form-input"
                  style={{ flex: '1 1 90px', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                  value={optionEndTime}
                  onChange={e => setOptionEndTime(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem', flex: '1 1 auto' }}
                  onClick={handleProposeNewOption}
                  disabled={submitting}
                >
                  Guardar Propuesta
                </button>
              </div>
            </div>
          )}

          {/* Lista de Opciones Votables */}
          {options.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border-strong)',
              borderRadius: '8px',
              padding: '1.1rem',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.84rem'
            }}>
              Este sondeo está en modo <strong>Horario Abierto</strong> (sin fechas fijas propuestas todavía). Pulsa <strong>"Proponer Fecha / Franja"</strong> arriba o indica tu disponibilidad general más abajo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {options.map(opt => {
                const votes = opt.votes || [];
                const yesVotes = votes.filter(v => v.status === 'yes');
                const maybeVotes = votes.filter(v => v.status === 'if_needed');
                const myVote = user ? votes.find(v => v.uid === user.uid) : null;
                const isTopOption = maxYesVotes > 0 && yesVotes.length === maxYesVotes;
                const canRemoveOpt = canManage || (user && opt.createdByUid === user.uid);

                return (
                  <div
                    key={opt.id}
                    style={{
                      background: isTopOption ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: isTopOption ? '1px solid #10b981' : '1px solid var(--border-strong)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff' }}>
                            {opt.label}
                          </span>
                          <span style={{
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: 'rgba(255,255,255,0.08)',
                            color: '#e4e4e7',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.15)'
                          }}>
                            {opt.startTime} - {opt.endTime} ({opt.slotLabel || 'Horario'})
                          </span>
                          {isTopOption && (
                            <span style={{
                              fontSize: '0.66rem',
                              fontFamily: 'var(--font-stencil)',
                              letterSpacing: '0.05em',
                              background: '#064e3b',
                              color: '#34d399',
                              border: '1px solid #10b981',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              MAYOR QUÓRUM ({yesVotes.length})
                            </span>
                          )}
                        </div>
                        {opt.createdByName && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Propuesto por: {opt.createdByName}
                          </div>
                        )}
                      </div>

                      {/* Botones de votación (Disponible / Si hace falta) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleVoteOption(opt.id, 'yes')}
                          disabled={submitting}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '0.32rem 0.65rem',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            borderRadius: '5px',
                            cursor: 'pointer',
                            border: myVote?.status === 'yes' ? '1px solid #10b981' : '1px solid var(--border-strong)',
                            background: myVote?.status === 'yes' ? '#10b981' : '#18181b',
                            color: myVote?.status === 'yes' ? '#000000' : '#ffffff'
                          }}
                          title="Marcar que estoy disponible en este horario"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Disponible ({yesVotes.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleVoteOption(opt.id, 'if_needed')}
                          disabled={submitting}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '0.32rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '5px',
                            cursor: 'pointer',
                            border: myVote?.status === 'if_needed' ? '1px solid #f59e0b' : '1px solid var(--border-strong)',
                            background: myVote?.status === 'if_needed' ? 'rgba(245, 158, 11, 0.25)' : '#18181b',
                            color: myVote?.status === 'if_needed' ? '#fbbf24' : 'var(--text-secondary)'
                          }}
                          title="Podría ajustarme si hace falta / En duda"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>Dudoso ({maybeVotes.length})</span>
                        </button>

                        {canRemoveOpt && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOption(opt.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Eliminar esta opción"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista de personas que han votado esta opción + botón de consolidar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {votes.length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Sin votos aún en esta franja
                          </span>
                        ) : (
                          votes.map(v => {
                            const isYes = v.status === 'yes';
                            return (
                              <span
                                key={v.uid}
                                style={{
                                  fontSize: '0.73rem',
                                  padding: '1px 7px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: isYes ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                                  border: isYes ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
                                  color: isYes ? '#34d399' : '#fbbf24'
                                }}
                              >
                                <span>{v.name}{!isYes ? ' (?)' : ''}</span>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVoterFromOption(opt.id, v.uid)}
                                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                                    title="Quitar voto"
                                  >
                                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                )}
                              </span>
                            );
                          })
                        )}
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleConfirmAndBook(opt)}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.6rem',
                            borderColor: '#10b981',
                            color: '#34d399',
                            whiteSpace: 'nowrap'
                          }}
                          title="Elegir este horario y crear la Reserva Oficial con estos participantes"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <polyline points="9 14 11 16 15 12" />
                          </svg>
                          <span>Reservar esta Opción</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECCIÓN 2: DISPONIBILIDAD LIBRE / CUADRANTE PERSONAL DE INTEGRANTES */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
          padding: '0.95rem',
          marginBottom: '1.1rem'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Tu Disponibilidad General (Días y Franjas Libres)</span>
          </h4>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
            Marca qué tramos semanales te vienen bien o deja una nota para cuadrar con el grupo:
          </p>

          {/* Etiquetas rápidas de franjas semanales */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
            {QUICK_AVAILABILITY_TAGS.map(tag => {
              const active = myTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleQuickTag(tag)}
                  style={{
                    fontSize: '0.73rem',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                    background: active ? 'rgba(16, 185, 129, 0.22)' : '#18181b',
                    border: active ? '1px solid #10b981' : '1px solid var(--border-light)',
                    color: active ? '#34d399' : 'var(--text-secondary)'
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: '1 1 200px', fontSize: '0.82rem', padding: '0.48rem 0.7rem' }}
              placeholder="Ej. Puedo sábados de 16:00 a 21:00 o viernes a partir de las 18:30..."
              value={myGeneralNote}
              onChange={e => setMyGeneralNote(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.45rem 0.85rem',
                borderColor: noteSavedFeedback ? '#10b981' : undefined,
                color: noteSavedFeedback ? '#34d399' : undefined
              }}
              onClick={handleSaveMyAvailability}
              disabled={submitting}
            >
              {noteSavedFeedback ? 'Disponibilidad Guardada' : 'Guardar mi Disponibilidad'}
            </button>
          </div>

          {/* Listado de notas de disponibilidad de todos los integrantes */}
          {participantNotes.length > 0 && (
            <div style={{ marginTop: '0.85rem', paddingTop: '0.7rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Disponibilidad indicada por los integrantes ({participantNotes.length}):
              </div>
              {participantNotes.map(note => (
                <div
                  key={note.uid}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#ffffff' }}>{note.name}:</strong>
                    {(note.tags || []).map(t => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {note.generalAvailability && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.79rem' }}>
                      "{note.generalAvailability}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN 3: GESTIÓN DE INVITADOS / SOCIOS POR ORGANIZADOR O ADMIN */}
        {canManage && options.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border-light)',
            borderRadius: '8px',
            padding: '0.85rem',
            marginBottom: '1.1rem'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '0.5rem' }}>
              Añadir Socio o Invitado Manual a una Opción (Organizador / Admin):
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <select
                className="form-input"
                style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                value={targetOptionForManual}
                onChange={e => setTargetOptionForManual(e.target.value)}
              >
                {options.map(o => (
                  <option key={o.id} value={o.id}>
                    Opción: {o.label} ({o.startTime} - {o.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
              <select
                className="form-input"
                style={{ flex: '1 1 160px', fontSize: '0.8rem', padding: '0.4rem' }}
                value={selectedSocioUid}
                onChange={e => setSelectedSocioUid(e.target.value)}
              >
                <option value="">-- Seleccionar Socio Registrado --</option>
                {registeredUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.7rem' }}
                disabled={!selectedSocioUid || submitting}
                onClick={() => handleAddParticipantByManager(false)}
              >
                + Añadir Socio
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: '1 1 160px', fontSize: '0.8rem', padding: '0.4rem' }}
                placeholder="Nombre de invitado sin app..."
                value={manualParticipantName}
                onChange={e => setManualParticipantName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.7rem' }}
                disabled={!manualParticipantName.trim() || submitting}
                onClick={() => handleAddParticipantByManager(true)}
              >
                + Invitado
              </button>
            </div>
          </div>
        )}

        {/* Pie del Modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.7rem',
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '1rem'
        }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>

          {canManage && (
            <button
              type="button"
              className="btn"
              style={{
                background: '#10b981',
                borderColor: '#10b981',
                color: '#000000',
                fontSize: '0.84rem',
                padding: '0.6rem 1.1rem'
              }}
              onClick={() => {
                // Pre-seleccionar la opción con más votos si existe
                let bestOpt = null;
                if (options.length > 0) {
                  bestOpt = [...options].sort((a, b) => {
                    const yesA = (a.votes || []).filter(v => v.status === 'yes').length;
                    const yesB = (b.votes || []).filter(v => v.status === 'yes').length;
                    return yesB - yesA;
                  })[0];
                }
                handleConfirmAndBook(bestOpt);
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Confirmar y Crear Reserva Oficial</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
