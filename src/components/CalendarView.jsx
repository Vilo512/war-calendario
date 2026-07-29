import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdminRole, isSocio, isSemiSocio, canBook as canBookUser, ROLES } from '../utils/roleUtils';
import { sendWhatsAppMessage, editWhatsAppMessage, buildWhatsAppMessageText, buildWhatsAppCancelText } from '../services/whatsappService';
import AttendeesModal from './AttendeesModal';
import RoomPickerModal from './RoomPickerModal';
import SyncModal from './SyncModal';

export default function CalendarView({ user, userRole, onOpenBooking, onDuplicateBooking }) {
  const [bookings, setBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL'); // 'ALL' or specific room name
  const [selectedBookingForAttendees, setSelectedBookingForAttendees] = useState(null);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Cargar salas dinámicas de Firestore (sin salas por defecto)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const rList = [];
      snapshot.forEach(d => rList.push(d.data().name));
      setRoomsList(rList);
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

  const availableRooms = roomsList;

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
    const temp = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(temp.getFullYear(), temp.getMonth(), diff);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
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

  const formatDisplayDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return String(dateStr);
  };

  const isAdmin = isAdminRole(userRole);
  const canDelete = (booking) => isAdmin || (user && booking.userId === user.uid);

  const handleDelete = async (booking) => {
    if (window.confirm('¿Estás seguro de que deseas cancelar este evento?')) {
      try {
        const relatedBookings = booking.overnightGroupId
          ? bookings.filter(b => b.overnightGroupId === booking.overnightGroupId)
          : [booking];

        await Promise.all(relatedBookings.map(b => deleteDoc(doc(db, 'bookings', b.id))));
        
        // Si la reserva original fue anunciada por WhatsApp, editamos o enviamos el aviso de cancelación
        if (booking.whatsapp_sent) {
          const cancelMsg = buildWhatsAppCancelText(booking);
          if (booking.whatsapp_message_id) {
            editWhatsAppMessage(booking.whatsapp_message_id, cancelMsg).catch(err => console.error("Error editando aviso de cancelación en WhatsApp:", err));
          } else {
            sendWhatsAppMessage(cancelMsg).catch(err => console.error("Error enviando aviso de cancelación:", err));
          }
        }
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

    if (!isAttending) {
      // 1. Validación de Actividad Cerrada
      if (booking.activityType === 'closed') {
        alert("🔒 Esta actividad es una mesa cerrada/privada por el organizador. Las plazas no están abiertas.");
        return;
      }

      // 2. Validación de Público Objetivo (targetAudience)
      if (booking.targetAudience === 'socios' && !isSocio(userRole)) {
        alert("⭐ Esta actividad es exclusiva para miembros con estatus de Socio o Administrador.");
        return;
      }

      if (booking.targetAudience === 'semisocios' && (!userRole || userRole < ROLES.SEMISOCIO)) {
        alert("🤝 Esta actividad requiere estatus de Simpatizante (semisocio) o Socio.");
        return;
      }

      // 3. Validación de Aforo Máximo
      if (maxCount && attendees.length >= maxCount) {
        alert(`El evento ya ha alcanzado el límite máximo de ${maxCount} participantes.`);
        return;
      }
    }

    const relatedBookings = booking.overnightGroupId
      ? bookings.filter(b => b.overnightGroupId === booking.overnightGroupId)
      : [booking];

    try {
      let updatedAttendees = [];
      if (isAttending) {
        updatedAttendees = attendees.filter(a => a.uid !== user.uid);
      } else {
        const newAttendee = {
          uid: user.uid,
          name: user.displayName || user.email || 'Socio'
        };
        updatedAttendees = [...attendees, newAttendee];
      }

      await Promise.all(relatedBookings.map(b => updateDoc(doc(db, 'bookings', b.id), { attendees: updatedAttendees })));

      // Editar mensaje en WhatsApp si fue publicado y posee whatsapp_message_id
      if (booking.whatsapp_sent && booking.whatsapp_message_id) {
        const updatedMsg = buildWhatsAppMessageText(booking, updatedAttendees);
        editWhatsAppMessage(booking.whatsapp_message_id, updatedMsg).catch(err => console.error("Error al editar mensaje de WhatsApp tras asistencia:", err));
      }
    } catch (error) {
      console.error("Error al actualizar asistencia:", error);
      alert("Error al actualizar la asistencia al evento.");
    }
  };

  // Helpers para franjas horarias e iconos
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
  };

  const getDayTimeSlots = (dateBookings) => {
    const slots = { morning: false, afternoon: false, night: false };
    
    dateBookings.forEach(booking => {
      let startMin = parseTimeToMinutes(booking.startTime);
      let endMin = parseTimeToMinutes(booking.endTime);
      
      if (startMin === null && booking.time) {
        const lower = booking.time.toLowerCase();
        if (lower.includes('mañana')) slots.morning = true;
        if (lower.includes('tarde')) slots.afternoon = true;
        if (lower.includes('noche')) slots.night = true;
        return;
      }

      if (startMin !== null && endMin !== null) {
        if (endMin <= startMin) {
          endMin += 24 * 60;
        }
        // Mañana: 08:00 (480m) - 15:00 (900m)
        if (startMin < 900 && endMin > 480) slots.morning = true;
        // Tarde: 15:00 (900m) - 21:00 (1260m)
        if (startMin < 1260 && endMin > 900) slots.afternoon = true;
        // Noche: 21:00 (1260m) - 08:00 (1920m)
        if (startMin < 1920 && endMin > 1260) slots.night = true;
        if (startMin < 480) slots.night = true;
      } else if (startMin !== null) {
        if (startMin >= 480 && startMin < 900) slots.morning = true;
        else if (startMin >= 900 && startMin < 1260) slots.afternoon = true;
        else slots.night = true;
      } else {
        slots.afternoon = true;
      }
    });

    return slots;
  };

  const SunriseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" title="Mañana (08:00 - 15:00)">
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M12 2v7" />
      <path d="M4.22 10.22l3.54 3.54" />
      <path d="M19.78 10.22l-3.54 3.54" />
      <path d="M2 18h20" />
    </svg>
  );

  const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" title="Tarde (15:00 - 21:00)">
      <circle cx="12" cy="12" r="4" fill="#f97316" fillOpacity="0.25" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );

  const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" title="Noche (21:00 - 08:00)">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#a78bfa" fillOpacity="0.25" />
    </svg>
  );

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
                className={`calendar-day-cell ${d.isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today-day' : ''} ${isSelected ? 'active-day' : ''} ${hasBookings ? 'has-activity' : ''}`}
                onClick={() => {
                  setSelectedDate(d.date);
                  if (!d.isCurrentMonth) setCurrentDate(d.date);
                }}
              >
                <span className="day-number">{d.day}</span>
                {hasBookings && (() => {
                  const slots = getDayTimeSlots(dateBookings);
                  return (
                    <div className="day-time-slots">
                      {slots.morning && <SunriseIcon />}
                      {slots.afternoon && <SunIcon />}
                      {slots.night && <MoonIcon />}
                    </div>
                  );
                })()}
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
              + Nueva Reserva
            </button>
          </div>

          {/* Grid de Columnas por Sala (incluyendo salas huérfanas con reservas activas) */}
          {(() => {
            const orphanRooms = Array.from(new Set(
              dayBookings
                .filter(b => b.room && !availableRooms.includes(b.room))
                .map(b => b.room)
            ));
            const rawDisplayRooms = [...availableRooms, ...orphanRooms];

            const getRoomEarliestBookingMinutes = (roomName) => {
              const roomBookings = dayBookings.filter(b => b.room === roomName);
              if (roomBookings.length === 0) return Infinity;
              
              let minMinutes = Infinity;
              roomBookings.forEach(b => {
                const min = parseTimeToMinutes(b.startTime);
                if (min !== null && min < minMinutes) {
                  minMinutes = min;
                }
              });
              return minMinutes;
            };

            const displayRooms = [...rawDisplayRooms].sort((a, b) => {
              const bookingsA = dayBookings.filter(bk => bk.room === a);
              const bookingsB = dayBookings.filter(bk => bk.room === b);
              const isOccA = bookingsA.length > 0;
              const isOccB = bookingsB.length > 0;

              if (isOccA && !isOccB) return -1;
              if (!isOccA && isOccB) return 1;

              if (isOccA && isOccB) {
                const timeA = getRoomEarliestBookingMinutes(a);
                const timeB = getRoomEarliestBookingMinutes(b);
                if (timeA !== timeB) return timeA - timeB;
              }

              return rawDisplayRooms.indexOf(a) - rawDisplayRooms.indexOf(b);
            });

            if (displayRooms.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#141417', border: '1px dashed var(--border-light)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>No hay salas configuradas en el sistema. Un administrador debe añadir salas desde el Panel de Administración.</p>
                </div>
              );
            }

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${displayRooms.length > 2 ? '240px' : '280px'}, 1fr))`,
                gap: '1rem',
                alignItems: 'start'
              }}>
                {displayRooms.map((roomName) => {
                  const isOrphan = !availableRooms.includes(roomName);
                  const roomBookings = dayBookings
                    .filter(b => b.room === roomName)
                    .sort((a, b) => {
                      const timeA = parseTimeToMinutes(a.startTime) ?? Infinity;
                      const timeB = parseTimeToMinutes(b.startTime) ?? Infinity;
                      return timeA - timeB;
                    });
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
                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: isOrphan ? '#f59e0b' : '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {roomName}
                      {isOrphan && <span style={{ fontSize: '0.7rem', color: '#f59e0b', border: '1px solid #f59e0b', padding: '1px 5px', borderRadius: '4px' }}>(Descatalogada)</span>}
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

                                {/* Badges del Bloque 4 (Cerrada / Público Objetivo) */}
                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                                  {booking.activityType === 'closed' && (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      🔒 CERRADA
                                    </span>
                                  )}
                                  {booking.targetAudience === 'socios' && (
                                    <span style={{ fontSize: '0.65rem', background: '#064e3b', color: '#34d399', border: '1px solid #10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      ⭐ SOLO SOCIOS
                                    </span>
                                  )}
                                  {booking.targetAudience === 'semisocios' && (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      🤝 SOCIOS Y SIMPATIZANTES
                                    </span>
                                  )}
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

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button
                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                                  onClick={() => setSelectedBookingForAttendees(booking)}
                                  title="Ver lista completa de asistentes"
                                >
                                  Asistentes: {attendees.length}{maxCount ? `/${maxCount}` : ''}
                                </button>

                                {user && canBookUser(userRole) && (
                                  <button
                                    onClick={() => onDuplicateBooking && onDuplicateBooking(booking)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
                                    title="Duplicar / Clonar esta reserva en otra fecha u hora"
                                  >
                                    📋 Duplicar
                                  </button>
                                )}
                              </div>

                              {user && (
                                <button 
                                  onClick={() => handleToggleAttendance(booking)} 
                                  disabled={!isAttending && (isFull || booking.activityType === 'closed')}
                                  className={isAttending ? "btn btn-secondary" : "btn"}
                                  style={{ 
                                    padding: '0.2rem 0.5rem', 
                                    fontSize: '0.7rem', 
                                    whiteSpace: 'nowrap',
                                    opacity: (!isAttending && (isFull || booking.activityType === 'closed')) ? 0.6 : 1,
                                    cursor: (!isAttending && (isFull || booking.activityType === 'closed')) ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {isAttending ? '✓ Me apunté' : (booking.activityType === 'closed' ? '🔒 Cerrada' : (isFull ? 'Lleno' : '+ Apuntarme'))}
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
          );
        })()}
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

  const getVisibleBookings = () => {
    let list = bookings;
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      list = list.filter(b => {
        if (!b.date) return false;
        const [y, m] = b.date.split('-').map(Number);
        return y === year && (m - 1) === month;
      });
    } else {
      const weekDays = getWeekDays();
      const dateStrs = weekDays.map(formatDateString);
      list = list.filter(b => dateStrs.includes(b.date));
    }

    if (selectedRoomFilter !== 'ALL') {
      list = list.filter(b => b.room === selectedRoomFilter);
    }

    return list;
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

          {/* Botón compacto de Sincronización con Calendarios */}
          <button 
            className="btn btn-secondary"
            style={{ 
              fontSize: '0.82rem', 
              padding: '0.4rem 0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem'
            }}
            onClick={() => setIsSyncModalOpen(true)}
            title="Sincronizar reservas visibles con tu calendario"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Sincronizar</span>
          </button>

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

      {/* Modal de Detalle de Asistentes con Sincronización en Tiempo Real */}
      {(() => {
        const liveBooking = selectedBookingForAttendees
          ? (bookings.find(b => b.id === selectedBookingForAttendees.id) || selectedBookingForAttendees)
          : null;
        
        return (
          <AttendeesModal
            isOpen={!!selectedBookingForAttendees}
            onClose={() => setSelectedBookingForAttendees(null)}
            booking={liveBooking}
            user={user}
            userRole={userRole}
            onToggleAttendance={(b) => {
              handleToggleAttendance(b);
            }}
          />
        );
      })()}

      {/* Modal / Action Sheet de Selección Táctil de Sala para Móvil */}
      <RoomPickerModal
        isOpen={isRoomPickerOpen}
        onClose={() => setIsRoomPickerOpen(false)}
        rooms={availableRooms}
        selectedRoom={selectedRoomFilter}
        onSelectRoom={(r) => setSelectedRoomFilter(r)}
      />

      {/* Modal de Sincronización con Calendarios (iPhone, Google, Outlook, iCal) */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        visibleBookings={getVisibleBookings()}
        selectedRoomFilter={selectedRoomFilter}
        viewMode={viewMode}
      />
    </div>
  );
}
