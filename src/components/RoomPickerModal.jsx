import React from 'react';

export default function RoomPickerModal({ isOpen, onClose, rooms, selectedRoom, onSelectRoom }) {
  if (!isOpen) return null;

  const allOptions = [
    { id: 'ALL', name: 'Todas las salas' },
    ...rooms.map(r => ({ id: r, name: r }))
  ];

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(10, 10, 12, 0.88)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        zIndex: 1200,
        padding: '0',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '500px',
          background: '#141417',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          border: '1px solid var(--accent-primary)',
          borderBottom: 'none',
          padding: '1.5rem',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.8)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 1.2rem auto' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 'bold' }}>
              Seleccionar Sala
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Filtra la vista del calendario por estudio
            </p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
          {allOptions.map((opt) => {
            const isSelected = selectedRoom === opt.id;

            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelectRoom(opt.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.9rem 1.2rem',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.12)',
                  background: isSelected ? '#ffffff' : 'rgba(255,255,255,0.04)',
                  color: isSelected ? '#000000' : 'var(--text-primary)',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{opt.name}</span>
                {isSelected && (
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>

        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
