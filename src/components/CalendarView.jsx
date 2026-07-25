import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminRole } from '../utils/roleUtils';
import AttendeesModal from './AttendeesModal';
import RoomPickerModal from './RoomPickerModal';

export default function CalendarView({ user, userRole, onOpenBooking }) {
  const [bookings, setBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL'); // 'ALL' or specific room name
  const [selectedBookingForAttendees, setSelectedBookingForAttendees] = useState(null);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);

  const defaultRooms = ['Estudio A', 'Estudio B', 'Sala Conferencias'];

  // Cargar salas dinámicas de Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach(d => rList.push(d.data().name));
      setRoomsList(rList.length > 0 ? rList : defaultRooms);
    });
    return () => unsub();
  }, []);

  // Cargar reservas
  useEffect(() => {
    try {
      const q = query(collection(db, 'bookings'), orderBy('date', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBookings(data);
        setLoading(false);
      }, (error) => {
        console.error("Firestore Error:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch(err) {
      console.log(err);
      setLoading(false);
    }
  }, []);

  const availableRooms = roomsList.length > 0 ? roomsList : defaultRooms;

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0 is Monday, 6 is Sunday
  };

  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    }
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  };

  const getWeekDays = () => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(currentDate.setDate(diff));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getBookingsForDate = (date) => {
    const dateStr = formatDateString(date);
    return bookings.filter(b => b.date === dateStr);
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const isAdmin = isAdminRole(userRole);
  const canDelete = (booking) => isAdmin || (user && booking.userId === user.uid);

  const handleDelete = async (booking) => {
    if (window.confirm('¿Estás seguro de que deseas cancelar esta reserva?')) {
      try {
        await deleteDoc(doc(db, 'bookings', booking.id));
      } catch (error) {
        console.error("Error al borrar:", error);
        alert("No tienes permiso para borrar esta reserva.");
      }
    }
  };

  const handleToggleAttendance = async (booking) => {
    if (!user) return;
    const attendees = booking.attendees || [];
    const isAttending = attendees.some(a => a.uid === user.uid);
    const maxCount = booking.maxAttendees || null;

    if (!isAttending && maxCount && attendees.length >= maxCount) {
      alert(`El evento ya ha alcanzado el límite máximo de ${maxCount} participantes.`);
      return;
    }

    const bookingRef = doc(db, 'bookings', booking.id);

    try {
      if (isAttending) {
        const updatedAttendees = attendees.filter(a => a.uid !== user.uid);
        await updateDoc(bookingRef, { attendees: updatedAttendees });
      } else {
        const newAttendee = {
          uid: user.uid,
          name: user.displayName || user.email || 'Socio'
        };
        const updatedAttendees = [...attendees, newAttendee];
        await updateDoc(bookingRef, { attendees: updatedAttendees });
      }
    } catch (error) {
      console.error("Error al actualizar asistencia:", error);
      alert("Error al actualizar la asistencia al evento.");
    }
  };

  // Helper para mostrar rango horario de la reserva
  const renderTimeRange = (booking) => {
    if (booking.startTime && booking.endTime) {
      return `${booking.startTime} - ${booking.endTime}`;
    }
    return booking.time || 'Horario no especificado';
  };

  const renderMonthView = () => {
    const days = getMonthDays();
    const todayStr = formatDateString(new Date());
    const selectedStr = formatDateString(selectedDate);
    const dayBookings = getBookingsForDate(selectedDate);

    return (
      <div className="calendar-container">
        <div className="calendar-header-days">
          {dayNames.map(d => <div key={d} className="day-name">{d}</div>)}
        </div>
        <div className="calendar-month-grid">
          {days.map((d, i) => {
            const dateStr = formatDateString(d.date);
            const dateBookings = getBookingsForDate(d.date);
            const hasBookings = dateBookings.length > 0;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;

            return (
              <div 
                key={i} 
                className={`calendar-day-cell ${d.isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today-day' : ''} ${isSelected ? 'active-day' : ''}`}
                onClick={() => {
                  setSelectedDate(d.date);
                  if (!d.isCurrentMonth) setCurrentDate(d.date);
                }}
              >
                <span className="day-number">{d.day}</span>
                {hasBookings && <div className="day-dot"></div>}
              </div>
            );
          })}
        </div>
        
        {/* Sección de Ocupación por Columnas de Salas para el día seleccionado */}
        <div className="selected-day-details" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Ocupación de Salas: {selectedDate.getDate()} de {monthNames[selectedDate.getMonth()]}
            </h3>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
              onClick={() => onOpenBooking && onOpenBooking(selectedStr, availableRooms[0])}
            >
              + Nueva Reserva Este Día
            </button>
          </div>

          {/* Grid de Columnas por Sala (2 o 3 columnas) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${availableRooms.length > 2 ? '240px' : '280px'}, 1fr))`,
            gap: '1rem',
            alignItems: 'start'
          }}>
            {availableRooms.map((roomName) => {
              const roomBookings = dayBookings.filter(b => b.room === roomName);
              const isOccupied = roomBookings.length > 0;

              return (
                <div 
                  key={roomName} 
                  style={{
                    background: '#141417',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem'
                  }}
                >
                  {/* Encabezado de la columna de sala con distintivo Ocupada / Libre */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#ffffff' }}>
                      {roomName}
                    </span>
                    {isOccupied ? (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        OCUPADA ({roomBookings.length})
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', border: '1px solid var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        LIBRE
                      </span>
                    )}
                  </div>

                  {/* Contenido de reservas o estado Libre */}
                  {!isOccupied ? (
                    <div style={{ textAlign: 'center', padding: '1.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '6px', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                      <p style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: '600', margin: '0 0 0.6rem 0' }}>
                        Sala disponible todo el día
                      </p>
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', width: '100%' }}
                        onClick={() => onOpenBooking && onOpenBooking(selectedStr, roomName)}
                      >
                        + Reservar en {roomName}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {roomBookings.map((booking) => {
                        const attendees = booking.attendees || [];
                        const isAttending = user && attendees.some(a => a.uid === user.uid);
                        const maxCount = booking.maxAttendees || null;
                        const isFull = maxCount && attendees.length >= maxCount;

                        return (
                          <div key={booking.id} className="booking-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem', padding: '0.8rem', background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{booking.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Por: {booking.userName || booking.userEmail || 'Socio'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="booking-time" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {renderTimeRange(booking)}
                                </span>
                                {canDelete(booking) && (
                                  <button onClick={() => handleDelete(booking)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '1.2rem', lineHeight: 1 }} title="Borrar Reserva">
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem' }}>
                              <button
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                                onClick={() => setSelectedBookingForAttendees(booking)}
                                title="Ver lista completa de asistentes"
                              >
                                Asistentes: {attendees.length}{maxCount ? `/${maxCount}` : ''}
                              </button>

                              {user && (
                                <button 
                                  onClick={() => handleToggleAttendance(booking)} 
                                  disabled={!isAttending && isFull}
                                  className={isAttending ? "btn btn-secondary" : "btn"}
                                  style={{ 
                                    padding: '0.2rem 0.5rem', 
                                    fontSize: '0.7rem', 
                                    whitespace: 'nowrap',
                                    opacity: (!isAttending && isFull) ? 0.6 : 1,
                                    cursor: (!isAttending && isFull) ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {isAttending ? '✓ Me apunté' : (isFull ? 'Lleno' : '+ Apuntarme')}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', marginTop: '0.2rem' }}
                        onClick={() => onOpenBooking && onOpenBooking(selectedStr, roomName)}
                      >
                        + Reservar en {roomName}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const todayStr = formatDateString(new Date());

    return (
      <div className="calendar-week-container">
        {weekDays.map((d, i) => {
          const dateStr = formatDateString(d);
          let dayBookings = getBookingsForDate(d);

          if (selectedRoomFilter !== 'ALL') {
            dayBookings = dayBookings.filter(b => b.room === selectedRoomFilter);
          }

          const isToday = dateStr === todayStr;

          return (
            <div key={i} className={`week-day-column ${isToday ? 'today-column' : ''}`}>
              <div className="week-day-header">
                <span className="week-day-name">{dayNames[i]}</span>
                <span className={`week-day-number ${isToday ? 'today-number' : ''}`}>{d.getDate()}</span>
              </div>
              <div className="week-day-content">
                {dayBookings.length === 0 ? (
                  <div className="empty-day-slot">-</div>
                ) : (
                  dayBookings.map((booking) => {
                    const attendees = booking.attendees || [];
                    const isAttending = user && attendees.some(a => a.uid === user.uid);
                    const maxCount = booking.maxAttendees || null;
                    const isFull = maxCount && attendees.length >= maxCount;

                    return (
                      <div key={booking.id} className="booking-card-mini">
                        <div className="mini-time" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{renderTimeRange(booking)}</span>
                          {canDelete(booking) && (
                            <button onClick={() => handleDelete(booking)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0', fontSize: '1rem', lineHeight: '1' }} title="Borrar Reserva">×</button>
                          )}
                        </div>
                        <div className="mini-name">{booking.name}</div>
                        <div className="mini-room" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{booking.room}</div>
                        {user && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', paddingTop: '0.3rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                              onClick={() => setSelectedBookingForAttendees(booking)}
                              title="Ver lista de asistentes"
                            >
                              Asistentes: {attendees.length}{maxCount ? `/${maxCount}` : ''}
                            </button>
                            <button 
                              onClick={() => handleToggleAttendance(booking)}
                              disabled={!isAttending && isFull}
                              style={{ 
                                background: isAttending ? 'rgba(16, 185, 129, 0.2)' : (isFull ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.2)'), 
                                color: isAttending ? 'var(--success)' : (isFull ? 'var(--text-secondary)' : 'var(--accent-primary)'), 
                                border: 'none', 
                                borderRadius: '4px', 
                                padding: '1px 5px', 
                                fontSize: '0.7rem', 
                                cursor: (!isAttending && isFull) ? 'not-allowed' : 'pointer' 
                              }}
                            >
                              {isAttending ? '✓ Apuntado' : (isFull ? 'Lleno' : '+ Asistir')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const headerText = viewMode === 'month' 
    ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : `Semana del ${getWeekDays()[0].getDate()} de ${monthNames[getWeekDays()[0].getMonth()]}`;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="header calendar-main-header">
        <h2 className="title" style={{ margin: 0 }}>{headerText}</h2>
        
        <div className="calendar-controls" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
          {/* Botón táctil para el selector de filtro por Sala (Action Sheet / Modal en móvil) */}
          <button 
            className="btn btn-secondary"
            style={{ 
              fontSize: '0.85rem', 
              padding: '0.4rem 0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem',
              borderColor: selectedRoomFilter !== 'ALL' ? 'var(--accent-primary)' : undefined,
              color: selectedRoomFilter !== 'ALL' ? 'var(--accent-primary)' : undefined,
              fontWeight: selectedRoomFilter !== 'ALL' ? 'bold' : 'normal'
            }}
            onClick={() => setIsRoomPickerOpen(true)}
          >
            <span>
              Sala: {selectedRoomFilter === 'ALL' ? 'Todas las salas' : selectedRoomFilter}
            </span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>▾</span>
          </button>

          {/* Selector de vista Mes / Semana */}
          <div className="view-toggles">
            <button 
              className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >Mes</button>
            <button 
              className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >Semana</button>
          </div>

          <div className="nav-arrows">
            <button className="nav-btn" onClick={prevPeriod}>&lt;</button>
            <button className="nav-btn" onClick={nextPeriod}>&gt;</button>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>
      ) : (
        viewMode === 'month' ? renderMonthView() : renderWeekView()
      )}

      {/* Modal de Detalle de Asistentes */}
      <AttendeesModal
        isOpen={!!selectedBookingForAttendees}
        onClose={() => setSelectedBookingForAttendees(null)}
        booking={selectedBookingForAttendees}
        user={user}
        onToggleAttendance={(b) => {
          handleToggleAttendance(b);
          setSelectedBookingForAttendees(null);
        }}
      />

      {/* Modal / Action Sheet de Selección Táctil de Sala para Móvil */}
      <RoomPickerModal
        isOpen={isRoomPickerOpen}
        onClose={() => setIsRoomPickerOpen(false)}
        rooms={availableRooms}
        selectedRoom={selectedRoomFilter}
        onSelectRoom={(r) => setSelectedRoomFilter(r)}
      />
    </div>
  );
}
