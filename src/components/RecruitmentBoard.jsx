import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminRole, isSocio, canBook as canBookUser, ROLES } from '../utils/roleUtils';
import { editWhatsAppMessage, buildWhatsAppPollMessageText } from '../services/whatsappService';
import TacticalPollDetailModal from './TacticalPollDetailModal';

export default function RecruitmentBoard({
  user,
  userRole,
  onOpenNewPoll,
  onConvertPollToBooking,
  initialPollId = null,
  onClearInitialPollId = null
}) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('open'); // 'open' | 'confirmed'
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tactical_polls'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPolls(data);
      setLoading(false);
    }, (err) => {
      console.error('Error cargando Sondeos Tácticos:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Abrir automáticamente si viene por parámetro URL ?poll=...
  useEffect(() => {
    if (initialPollId && polls.length > 0) {
      const target = polls.find(p => p.id === initialPollId);
      if (target) {
        setSelectedPollId(target.id);
        setIsCollapsed(false);
      }
      if (onClearInitialPollId) onClearInitialPollId();
    }
  }, [initialPollId, polls]);

  const activePolls = polls.filter(p => p.status !== 'confirmed');
  const confirmedPolls = polls.filter(p => p.status === 'confirmed');
  const displayedPolls = filterStatus === 'open' ? activePolls : confirmedPolls;

  const selectedPoll = polls.find(p => p.id === selectedPollId) || null;
  const isAdmin = isAdminRole(userRole);
  const userCanBook = canBookUser(userRole);

  // Voto rápido de 1 clic desde la tarjeta del tablón
  const handleQuickToggleVote = async (poll, optionId, e) => {
    e.stopPropagation();
    if (!user) return;

    if (poll.targetAudience === 'socios' && !isSocio(userRole)) {
      alert('Este Sondeo Táctico es exclusivo para miembros con estatus de Socio o Administrador.');
      return;
    }
    if (poll.targetAudience === 'semisocios' && (!userRole || userRole < ROLES.SEMISOCIO)) {
      alert('Este Sondeo Táctico requiere estatus de Simpatizante (semisocio) o Socio.');
      return;
    }

    const voterName = user.displayName || user.email || 'Socio';
    const updatedOptions = (poll.options || []).map(opt => {
      if (opt.id !== optionId) return opt;
      const currentVotes = opt.votes || [];
      const existing = currentVotes.find(v => v.uid === user.uid);
      let nextVotes;
      if (existing && existing.status === 'yes') {
        nextVotes = currentVotes.filter(v => v.uid !== user.uid);
      } else if (existing) {
        nextVotes = currentVotes.map(v => v.uid === user.uid ? { ...v, status: 'yes', name: voterName } : v);
      } else {
        nextVotes = [...currentVotes, { uid: user.uid, name: voterName, status: 'yes' }];
      }
      return { ...opt, votes: nextVotes };
    });

    try {
      await updateDoc(doc(db, 'tactical_polls', poll.id), { options: updatedOptions });
      if (poll.whatsapp_sent && poll.whatsapp_message_id) {
        const updatedPoll = { ...poll, options: updatedOptions };
        const msg = buildWhatsAppPollMessageText(updatedPoll, poll.id);
        editWhatsAppMessage(poll.whatsapp_message_id, msg).catch(() => {});
      }
    } catch (err) {
      console.error('Error en voto rápido:', err);
    }
  };

  const handleDeletePoll = async (poll, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el sondeo "${poll.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'tactical_polls', poll.id));
    } catch (err) {
      console.error('Error borrando sondeo:', err);
    }
  };

  const getUniqueParticipantsCount = (poll) => {
    const set = new Set();
    (poll.options || []).forEach(o => {
      (o.votes || []).forEach(v => set.add(v.uid || v.name));
    });
    (poll.participantNotes || []).forEach(n => set.add(n.uid || n.name));
    return set.size;
  };

  return (
    <div
      className="glass-panel"
      style={{
        marginBottom: '1.5rem',
        borderLeft: '4px solid #10b981',
        padding: '1.25rem 1.4rem'
      }}
    >
      {/* Cabecera del Tablón de Reclutamiento */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.8rem',
        marginBottom: isCollapsed ? 0 : '1rem'
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flexWrap: 'wrap' }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.16)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <h2 className="title" style={{ margin: 0, fontSize: '1.35rem', lineHeight: 1.1 }}>
                Tablón de Reclutamiento
              </h2>
              <span style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-stencil)',
                letterSpacing: '0.05em',
                padding: '2px 8px',
                borderRadius: '12px',
                background: activePolls.length > 0 ? '#064e3b' : '#18181b',
                color: activePolls.length > 0 ? '#34d399' : 'var(--text-secondary)',
                border: activePolls.length > 0 ? '1px solid #10b981' : '1px solid var(--border-light)',
                fontWeight: 800
              }}>
                {activePolls.length} {activePolls.length === 1 ? 'SONDEO ACTIVO' : 'SONDEOS ACTIVOS'}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Sondeos Tácticos sin fecha cerrada (estilo Doodle) para cuadrar horarios entre integrantes
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!isCollapsed && confirmedPolls.length > 0 && (
            <div className="view-toggles" style={{ padding: '2px' }}>
              <button
                type="button"
                className={`toggle-btn ${filterStatus === 'open' ? 'active' : ''}`}
                style={{ fontSize: '0.74rem', padding: '0.32rem 0.65rem' }}
                onClick={() => setFilterStatus('open')}
              >
                Activos ({activePolls.length})
              </button>
              <button
                type="button"
                className={`toggle-btn ${filterStatus === 'confirmed' ? 'active' : ''}`}
                style={{ fontSize: '0.74rem', padding: '0.32rem 0.65rem' }}
                onClick={() => setFilterStatus('confirmed')}
              >
                Consolidados ({confirmedPolls.length})
              </button>
            </div>
          )}

          {userCanBook && (
            <button
              type="button"
              className="btn"
              onClick={onOpenNewPoll}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                background: '#10b981',
                borderColor: '#10b981',
                color: '#000000'
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Nuevo Sondeo</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ padding: '0.42rem 0.6rem', fontSize: '0.76rem' }}
            title={isCollapsed ? 'Desplegar Tablón de Reclutamiento' : 'Plegar Tablón de Reclutamiento'}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cuerpo del Tablón */}
      {!isCollapsed && (
        loading ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Cargando Sondeos Tácticos...
          </div>
        ) : displayedPolls.length === 0 ? (
          <div style={{
            padding: '1.3rem 1rem',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed var(--border-strong)',
            borderRadius: '8px',
            color: 'var(--text-secondary)'
          }}>
            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.86rem' }}>
              {filterStatus === 'open'
                ? 'No hay Sondeos Tácticos abiertos ahora mismo. ¿Quieres organizar una partida pero aún no habéis decidido día u hora?'
                : 'Aún no hay sondeos consolidados en el historial.'}
            </p>
            {filterStatus === 'open' && userCanBook && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onOpenNewPoll}
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', margin: '0 auto', borderColor: '#10b981', color: '#34d399' }}
              >
                + Abrir Primer Sondeo Táctico
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(275px, 1fr))',
            gap: '0.9rem'
          }}>
            {displayedPolls.map(poll => {
              const options = poll.options || [];
              const notes = poll.participantNotes || [];
              const totalParticipants = getUniqueParticipantsCount(poll);
              const isOrganizer = user && (user.uid === poll.userId || user.email === poll.userEmail);
              const canManage = isAdmin || isOrganizer;

              // Calcular el máximo de votos "yes" para resaltar la opción ganadora
              const maxVotes = options.reduce((m, o) => {
                const c = (o.votes || []).filter(v => v.status === 'yes').length;
                return c > m ? c : m;
              }, 0);

              return (
                <div
                  key={poll.id}
                  onClick={() => setSelectedPollId(poll.id)}
                  style={{
                    background: '#141417',
                    border: '1px solid var(--border-strong)',
                    borderTop: '3px solid #10b981',
                    borderRadius: '8px',
                    padding: '0.95rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, transform 0.15s'
                  }}
                >
                  <div>
                    {/* Cabecera de la tarjeta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#ffffff', lineHeight: 1.25 }}>
                          {poll.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Por: <strong style={{ color: '#e4e4e7' }}>{poll.userName || 'Socio'}</strong> · Sala: {poll.preferredRoom || 'Cualquiera'}
                        </div>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePoll(poll, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Eliminar Sondeo"
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Badges informativos */}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                      <span style={{
                        fontSize: '0.66rem',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700
                      }}>
                        {totalParticipants}{poll.maxAttendees ? `/${poll.maxAttendees}` : ''} INTERESADO(S)
                      </span>

                      {poll.targetAudience === 'socios' && (
                        <span style={{ fontSize: '0.65rem', background: '#064e3b', color: '#34d399', border: '1px solid #10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                          SOLO SOCIOS
                        </span>
                      )}
                      {poll.targetAudience === 'semisocios' && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                          SOCIOS Y SIMPATIZANTES
                        </span>
                      )}
                      {poll.description && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#e2e8f0',
                          border: '1px solid rgba(255,255,255,0.2)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          <span>Briefing</span>
                        </span>
                      )}
                    </div>

                    {/* Resumen de opciones propuestas o disponibilidad libre */}
                    <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {options.length > 0 ? (
                        <>
                          {options.slice(0, 3).map(opt => {
                            const votes = opt.votes || [];
                            const yesVotes = votes.filter(v => v.status === 'yes');
                            const iVotedYes = user && yesVotes.some(v => v.uid === user.uid);
                            const isLeader = maxVotes > 0 && yesVotes.length === maxVotes;

                            return (
                              <div
                                key={opt.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.35rem 0.55rem',
                                  borderRadius: '5px',
                                  background: isLeader ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                                  border: isLeader ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(255,255,255,0.07)',
                                  fontSize: '0.76rem'
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {opt.label} <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>({opt.startTime}-{opt.endTime})</span>
                                  </div>
                                  {yesVotes.length > 0 && (
                                    <div style={{ fontSize: '0.68rem', color: '#34d399', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {yesVotes.map(v => v.name).join(', ')}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => handleQuickToggleVote(poll, opt.id, e)}
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    flexShrink: 0,
                                    background: iVotedYes ? '#10b981' : '#18181b',
                                    color: iVotedYes ? '#000000' : '#ffffff',
                                    border: iVotedYes ? '1px solid #10b981' : '1px solid var(--border-strong)'
                                  }}
                                  title="Marcar / Desmarcar que puedo en esta opción"
                                >
                                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>{yesVotes.length}</span>
                                </button>
                              </div>
                            );
                          })}
                          {options.length > 3 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                              + {options.length - 3} opción(es) horaria(s) más...
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{
                          padding: '0.45rem 0.6rem',
                          borderRadius: '5px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px dashed rgba(255,255,255,0.12)',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}>
                          {notes.length > 0 ? (
                            <div>
                              <strong style={{ color: '#34d399' }}>Horario Abierto ({notes.length} disp.):</strong>{' '}
                              {notes.slice(0, 2).map(n => `${n.name} (${(n.tags || []).join(', ') || n.generalAvailability})`).join(' · ')}
                            </div>
                          ) : (
                            <span>Horario Abierto: Entra para proponer fechas o indicar qué días/franjas tienes libres.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pie de la tarjeta */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    paddingTop: '0.55rem',
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPollId(poll.id);
                      }}
                      style={{ flex: 1, fontSize: '0.74rem', padding: '0.35rem 0.6rem' }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>Indicar Disponibilidad</span>
                    </button>

                    {canManage && poll.status !== 'confirmed' && (
                      <button
                        type="button"
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPollId(poll.id);
                        }}
                        style={{
                          fontSize: '0.73rem',
                          padding: '0.35rem 0.65rem',
                          background: 'rgba(16, 185, 129, 0.2)',
                          borderColor: '#10b981',
                          color: '#34d399'
                        }}
                        title="Abrir para confirmar fecha y crear la Reserva Oficial"
                      >
                        <span>Reservar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal de Detalle y Votación del Sondeo Táctico */}
      {selectedPoll && (
        <TacticalPollDetailModal
          isOpen={Boolean(selectedPoll)}
          onClose={() => setSelectedPollId(null)}
          poll={selectedPoll}
          user={user}
          userRole={userRole}
          onConvertPollToBooking={(bookingTemplate) => {
            setSelectedPollId(null);
            if (onConvertPollToBooking) {
              onConvertPollToBooking(bookingTemplate);
            }
          }}
        />
      )}
    </div>
  );
}
