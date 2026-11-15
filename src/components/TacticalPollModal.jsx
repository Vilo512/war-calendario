import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { canBook as canBookUser, getRoleLabel } from '../utils/roleUtils';
import { sendWhatsAppMessage, buildWhatsAppPollMessageText } from '../services/whatsappService';

export const SLOT_PRESETS = [
  { id: 'morning', label: 'Mañana', startTime: '10:00', endTime: '14:00' },
  { id: 'afternoon', label: 'Tarde', startTime: '16:00', endTime: '20:00' },
  { id: 'night', label: 'Noche', startTime: '21:00', endTime: '23:59' },
  { id: 'all_day', label: 'Día Flexible', startTime: '10:00', endTime: '20:00' },
  { id: 'custom', label: 'Horario Exacto', startTime: '17:00', endTime: '21:00' }
];

export const GENERIC_DAYS = [
  'Viernes',
  'Sábado',
  'Domingo',
  'Fin de Semana',
  'Entre Semana (Lun-Jue)',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves'
];

export const formatPollDateDMY = (isoDateStr) => {
  if (!isoDateStr) return '';
  const parts = String(isoDateStr).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayName = !isNaN(dt.getTime()) ? `${dayNames[dt.getDay()]} ` : '';
    return `${dayName}${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(isoDateStr);
};

export default function TacticalPollModal({
  isOpen,
  onClose,
  user,
  userRole,
  onCreatedPoll = null
}) {
  const [formData, setFormData] = useState({
    name: '',
    preferredRoom: 'Cualquier sala disponible',
    targetAudience: 'publico',
    maxAttendees: '',
    description: '',
    announceOnWhatsApp: true,
    initialAvailabilityNote: ''
  });

  const [roomsList, setRoomsList] = useState([]);
  const [options, setOptions] = useState([]);

  // Estado del constructor de opciones propuestas
  const [optionMode, setOptionMode] = useState('date'); // 'date' | 'generic'
  const [optionDate, setOptionDate] = useState('');
  const [optionGenericDay, setOptionGenericDay] = useState('Sábado');
  const [optionSlotPreset, setOptionSlotPreset] = useState('afternoon');
  const [optionStartTime, setOptionStartTime] = useState('16:00');
  const [optionEndTime, setOptionEndTime] = useState('20:00');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach(d => rList.push(d.data().name));
      setRoomsList(rList);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split('T')[0];
      setFormData({
        name: '',
        preferredRoom: 'Cualquier sala disponible',
        targetAudience: 'publico',
        maxAttendees: '',
        description: '',
        announceOnWhatsApp: true,
        initialAvailabilityNote: ''
      });
      setOptions([]);
      setOptionMode('date');
      setOptionDate(todayStr);
      setOptionGenericDay('Sábado');
      setOptionSlotPreset('afternoon');
      setOptionStartTime('16:00');
      setOptionEndTime('20:00');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const userCanBook = canBookUser(userRole);

  const handleSelectSlotPreset = (presetId) => {
    setOptionSlotPreset(presetId);
    const found = SLOT_PRESETS.find(p => p.id === presetId);
    if (found) {
      setOptionStartTime(found.startTime);
      setOptionEndTime(found.endTime);
    }
  };

  const handleAddOption = () => {
    setErrorMsg('');
    let baseLabel = '';
    let dateValue = '';

    if (optionMode === 'date') {
      if (!optionDate) {
        setErrorMsg('Selecciona una fecha para añadir la opción.');
        return;
      }
      dateValue = optionDate;
      baseLabel = formatPollDateDMY(optionDate);
    } else {
      baseLabel = optionGenericDay;
    }

    const presetObj = SLOT_PRESETS.find(p => p.id === optionSlotPreset);
    const slotLabel = presetObj ? presetObj.label : 'Horario';

    const newOpt = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      mode: optionMode,
      date: dateValue,
      label: baseLabel,
      slotType: optionSlotPreset,
      slotLabel: slotLabel,
      startTime: optionStartTime || '16:00',
      endTime: optionEndTime || '20:00',
      createdByUid: user ? user.uid : 'anonymous',
      createdByName: user ? (user.displayName || user.email || 'Socio') : 'Socio',
      votes: user ? [{
        uid: user.uid,
        name: user.displayName || user.email || 'Socio',
        status: 'yes'
      }] : []
    };

    // Evitar duplicados exactos
    const isDuplicate = options.some(
      o => o.label === newOpt.label && o.startTime === newOpt.startTime && o.endTime === newOpt.endTime
    );
    if (isDuplicate) {
      setErrorMsg('Ya has añadido esa misma combinación de día y horario.');
      return;
    }

    setOptions(prev => [...prev, newOpt]);
  };

  const handleRemoveOption = (optId) => {
    setOptions(prev => prev.filter(o => o.id !== optId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!userCanBook) {
      setErrorMsg('Debes tener estatus de Socio o Administrador para iniciar un Sondeo Táctico.');
      return;
    }

    const cleanName = formData.name.trim();
    if (!cleanName) {
      setErrorMsg('Introduce el nombre de la partida o evento.');
      return;
    }

    const parsedMax = formData.maxAttendees ? parseInt(formData.maxAttendees, 10) : null;
    const organizerName = user ? (user.displayName || user.email || 'Socio') : 'Socio';

    const participantNotes = [];
    if (formData.initialAvailabilityNote.trim() && user) {
      participantNotes.push({
        uid: user.uid,
        name: organizerName,
        generalAvailability: formData.initialAvailabilityNote.trim(),
        tags: [],
        updatedAt: new Date().toISOString()
      });
    }

    const newPollData = {
      name: cleanName,
      preferredRoom: formData.preferredRoom || 'Cualquier sala disponible',
      targetAudience: formData.targetAudience || 'publico',
      maxAttendees: parsedMax,
      description: formData.description ? formData.description.trim() : '',
      options: options,
      participantNotes: participantNotes,
      status: 'open',
      userId: user ? user.uid : 'anonymous',
      userEmail: user ? user.email : '',
      userName: organizerName,
      createdAt: new Date(),
      whatsapp_sent: Boolean(formData.announceOnWhatsApp)
    };

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'tactical_polls'), newPollData);

      if (formData.announceOnWhatsApp) {
        try {
          const msg = buildWhatsAppPollMessageText(newPollData, docRef.id);
          const res = await sendWhatsAppMessage(msg);
          const msgId = res?.idMessage || res?.data?.idMessage || res?.data?.id || null;
          if (msgId) {
            await updateDoc(doc(db, 'tactical_polls', docRef.id), { whatsapp_message_id: msgId });
          }
        } catch (waErr) {
          console.error('Error enviando aviso de Sondeo Táctico a WhatsApp:', waErr);
        }
      }

      if (onCreatedPoll) {
        onCreatedPoll({ id: docRef.id, ...newPollData });
      }
      onClose();
    } catch (err) {
      console.error('Error creando Sondeo Táctico:', err);
      setErrorMsg(err.message || 'Error al crear el Sondeo Táctico.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '620px', width: '94%', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--success)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
            </svg>
            <h2 className="title" style={{ fontSize: '1.35rem', margin: 0 }}>
              Nuevo Sondeo Táctico
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem' }}
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Banner explicativo */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '8px',
          padding: '0.75rem 0.9rem',
          fontSize: '0.83rem',
          color: '#d1fae5',
          marginBottom: '1.2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          lineHeight: 1.4
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Reclutamiento y cuadre de horarios (Estilo Doodle):</strong> Crea una propuesta de partida sin bloquear ninguna sala todavía. Puedes proponer fechas/franjas a votar o dejarlo abierto para que los interesados indiquen cuándo tienen disponibilidad. Cuando haya quórum, podrás convertirlo en Reserva Oficial en un clic.
          </div>
        </div>

        {!userCanBook ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>
              Tu estatus actual es <strong>"{getRoleLabel(userRole)}"</strong>. Solamente los miembros con estatus de <strong>Socio</strong> o <strong>Administrador</strong> pueden abrir nuevos Sondeos Tácticos.
            </p>
            <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Entendido</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Nombre de la partida */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Nombre de la Partida / Operación</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Partida Rol Cthulhu / Warhammer 40k 2000pts / Euros Duros"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Sala preferida, Público Objetivo y Límite de jugadores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.82rem' }}>Sala Preferida (Opcional)</label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.88rem', padding: '0.6rem 0.75rem' }}
                  value={formData.preferredRoom}
                  onChange={e => setFormData({ ...formData, preferredRoom: e.target.value })}
                >
                  <option value="Cualquier sala disponible">Cualquier sala disponible</option>
                  {roomsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.82rem' }}>Público Objetivo</label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.88rem', padding: '0.6rem 0.75rem' }}
                  value={formData.targetAudience}
                  onChange={e => setFormData({ ...formData, targetAudience: e.target.value })}
                >
                  <option value="publico">Público General (Todos)</option>
                  <option value="semisocios">Socios y Simpatizantes</option>
                  <option value="socios">Exclusivo para Socios</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.82rem' }}>Jugadores Máx. (Opcional)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="form-input"
                  style={{ fontSize: '0.88rem', padding: '0.6rem 0.75rem' }}
                  placeholder="Ej. 4 (o vacío)"
                  value={formData.maxAttendees}
                  onChange={e => setFormData({ ...formData, maxAttendees: e.target.value })}
                />
              </div>
            </div>

            {/* Constructor Híbrido de Opciones de Fecha / Franja Horaria */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Propuestas de Días / Franjas a Votar ({options.length})</span>
                </h4>
                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                  Opcional: Los participantes también podrán añadir las suyas
                </span>
              </div>

              {/* Selector de modo: Fecha Concreta vs Día Genérico */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setOptionMode('date')}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '5px',
                    cursor: 'pointer',
                    border: optionMode === 'date' ? '1px solid #ffffff' : '1px solid var(--border-light)',
                    background: optionMode === 'date' ? 'rgba(255, 255, 255, 0.14)' : '#18181b',
                    color: optionMode === 'date' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  Fecha del Calendario
                </button>
                <button
                  type="button"
                  onClick={() => setOptionMode('generic')}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '5px',
                    cursor: 'pointer',
                    border: optionMode === 'generic' ? '1px solid #ffffff' : '1px solid var(--border-light)',
                    background: optionMode === 'generic' ? 'rgba(255, 255, 255, 0.14)' : '#18181b',
                    color: optionMode === 'generic' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  Día Genérico (Sin fecha fija)
                </button>
              </div>

              {/* Fila de selección de Día/Fecha y Franja */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '0.7rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    {optionMode === 'date' ? 'Fecha propuesta' : 'Día / Periodo'}
                  </label>
                  {optionMode === 'date' ? (
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.85rem' }}
                      value={optionDate}
                      onChange={e => setOptionDate(e.target.value)}
                    />
                  ) : (
                    <select
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.85rem' }}
                      value={optionGenericDay}
                      onChange={e => setOptionGenericDay(e.target.value)}
                    >
                      {GENERIC_DAYS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    Franja Horaria Rápida
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.85rem' }}
                    value={optionSlotPreset}
                    onChange={e => handleSelectSlotPreset(e.target.value)}
                  >
                    {SLOT_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>{p.label} ({p.startTime} - {p.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Horas inicio y fin + botón de añadir */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                    value={optionStartTime}
                    onChange={e => setOptionStartTime(e.target.value)}
                  />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                    value={optionEndTime}
                    onChange={e => setOptionEndTime(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddOption}
                  style={{
                    padding: '0.52rem 0.9rem',
                    fontSize: '0.8rem',
                    borderColor: '#10b981',
                    color: '#34d399',
                    flex: '1 1 auto'
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Añadir Opción</span>
                </button>
              </div>

              {/* Lista de opciones añadidas */}
              {options.length === 0 ? (
                <div style={{
                  marginTop: '0.8rem',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed var(--border-light)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center'
                }}>
                  Sin opciones fijas añadidas: el sondeo se publicará en modo <strong>"Horario Abierto"</strong> para que los integrantes propongan sus días y horas libres.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.85rem' }}>
                  {options.map((opt) => (
                    <div
                      key={opt.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '6px',
                        padding: '0.45rem 0.7rem',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{opt.label}</span>
                        <span style={{
                          fontSize: '0.72rem',
                          background: 'rgba(0,0,0,0.45)',
                          color: '#34d399',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          {opt.slotLabel}: {opt.startTime} - {opt.endTime}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Quitar opción"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nota de disponibilidad general del propio organizador */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.84rem' }}>
                Tu Disponibilidad General / Nota Horaria (Opcional)
              </label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}
                placeholder="Ej. Puedo viernes tarde o domingos por la mañana, adaptable..."
                value={formData.initialAvailabilityNote}
                onChange={e => setFormData({ ...formData, initialAvailabilityNote: e.target.value })}
              />
            </div>

            {/* Descripción y enlaces */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ margin: 0, fontSize: '0.84rem' }}>
                  Descripción, Reglas y Vídeos (Opcional)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const template = "Info:\nTutorial:\nReglas:";
                    setFormData(prev => ({
                      ...prev,
                      description: prev.description ? `${prev.description}\n\n${template}` : template
                    }));
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    padding: '2px 7px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Insertar plantilla</span>
                </button>
              </div>
              <textarea
                className="form-input"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: '0.85rem', lineHeight: 1.4 }}
                placeholder="Explica de qué va la partida, requisitos o pega enlaces de YouTube / manuales..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Notificar por WhatsApp */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '0.75rem 0.9rem',
              marginBottom: '1rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  style={{ width: '1.15rem', height: '1.15rem', accentColor: '#10b981', cursor: 'pointer' }}
                  checked={formData.announceOnWhatsApp}
                  onChange={e => setFormData({ ...formData, announceOnWhatsApp: e.target.checked })}
                />
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <span>Anunciar Sondeo Táctico en el grupo de WhatsApp de Avisos</span>
              </label>
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '0.9rem', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn"
                disabled={submitting}
                style={{ flex: 1 }}
              >
                {submitting ? 'Publicando...' : 'Publicar Sondeo Táctico'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
