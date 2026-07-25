import React from 'react';

export default function AttendeesModal({ isOpen, onClose, booking, user, onToggleAttendance }) {
  if (!isOpen || !booking) return null;

  const attendees = booking.attendees || [];
  const isAttending = user && attendees.some(a => a.uid === user.uid);
  const maxCount = booking.maxAttendees || null;
  const isFull = maxCount && attendees.length >= maxCount;

  const renderTimeRange = () => {
    if (booking.startTime && booking.endTime) {
      return `${booking.startTime} - ${booking.endTime}`;
    }
    return booking.time || 'Horario no especificado';
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '1.8rem', border: '1px solid var(--accent-primary)' }}>
        {/* Cabecera del modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 className="title" style={{ margin: 0, fontSize: '1.3rem' }}>{booking.name}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span>🏛️ {booking.room}</span>
              <span>📅 {booking.date}</span>
              <span>⏰ {renderTimeRange()}</span>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.8rem', borderRadius: '6px', marginBottom: '1.2rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Organizador / Reservado por: </span>
          <strong style={{ color: '#ffffff' }}>{booking.userName || booking.userEmail || 'Socio'}</strong>
        </div>

        {/* Barra de progreso de aforo */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 'bold' }}>👥 Asistentes Confirmados</span>
            <span style={{ color: isFull ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
              {attendees.length}{maxCount ? ` / ${maxCount} plazas` : ' (Sin límite de plazas)'}
            </span>
          </div>
          {maxCount && (
            <div style={{ background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                background: isFull ? 'var(--danger)' : 'var(--success)',
                width: `${Math.min(100, (attendees.length / maxCount) * 100)}%`,
                height: '100%',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          )}
        </div>

        {/* Lista detallada de asistentes */}
        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
          {attendees.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', margin: '1rem 0' }}>
              Aún no se ha apuntado nadie a esta actividad. ¡Sé el primero en unirte!
            </p>
          ) : (
            attendees.map((att, idx) => (
              <div key={att.uid || idx} className="booking-item" style={{ padding: '0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>#{idx + 1}</span>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{att.name}</span>
                </div>
                {att.uid === user?.uid && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    ¡Tú!
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          {user && (
            <button 
              className={isAttending ? "btn btn-secondary" : "btn"}
              style={{
                background: isAttending ? 'rgba(239, 68, 68, 0.2)' : undefined,
                color: isAttending ? 'var(--danger)' : undefined,
                borderColor: isAttending ? 'var(--danger)' : undefined,
                opacity: (!isAttending && isFull) ? 0.6 : 1,
                cursor: (!isAttending && isFull) ? 'not-allowed' : 'pointer'
              }}
              disabled={!isAttending && isFull}
              onClick={() => {
                onToggleAttendance(booking);
              }}
            >
              {isAttending ? '✓ Desapuntarme' : (isFull ? 'Lleno' : '+ Apuntarme')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
