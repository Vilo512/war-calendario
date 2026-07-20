import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function CalendarView({ user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // For month view details

  useEffect(() => {
    try {
      const q = query(collection(db, 'bookings'), orderBy('time', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (data.length === 0) {
          // Dummy data for visual check if empty
          const today = new Date().toISOString().split('T')[0];
          setBookings([
            { id: '1', name: 'Sesión de Retrato', room: 'Estudio A', date: today, time: '10:00' },
            { id: '2', name: 'Grabación Podcast', room: 'Estudio B', date: today, time: '14:30' },
          ]);
        } else {
          setBookings(data);
        }
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
    // Padding previous month
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    // Padding next month
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  };

  const getWeekDays = () => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
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

  const isAdmin = user && user.email === 'admin@warcalendario.com';
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

  const renderMonthView = () => {
    const days = getMonthDays();
    const todayStr = formatDateString(new Date());
    const selectedStr = formatDateString(selectedDate);

    return (
      <div className="calendar-container">
        <div className="calendar-header-days">
          {dayNames.map(d => <div key={d} className="day-name">{d}</div>)}
        </div>
        <div className="calendar-month-grid">
          {days.map((d, i) => {
            const dateStr = formatDateString(d.date);
            const hasBookings = getBookingsForDate(d.date).length > 0;
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
        
        {/* Detail section for selected day */}
        <div className="selected-day-details">
          <h3 style={{margin: '1rem 0', fontSize: '1.2rem', color: 'var(--accent-primary)'}}>
            Reservas para el {selectedDate.getDate()} de {monthNames[selectedDate.getMonth()]}
          </h3>
          <div className="calendar-grid">
            {getBookingsForDate(selectedDate).length === 0 ? (
              <p style={{color: 'var(--text-secondary)'}}>No hay reservas en este día.</p>
            ) : (
              getBookingsForDate(selectedDate).map((booking) => (
                <div key={booking.id} className="booking-item">
                  <div className="booking-details">
                    <span className="booking-name">{booking.name}</span>
                    <span className="booking-room">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '4px', display: 'inline-block'}}>
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                      {booking.room}
                    </span>
                  </div>
                  <div className="booking-time" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    {booking.time}
                    {canDelete(booking) && (
                      <button onClick={() => handleDelete(booking)} style={{background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px', fontSize: '1.2rem'}} title="Borrar Reserva">
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
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
          const dayBookings = getBookingsForDate(d);
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
                  dayBookings.map((booking) => (
                    <div key={booking.id} className="booking-card-mini">
                      <div className="mini-time" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        {booking.time}
                        {canDelete(booking) && (
                          <button onClick={() => handleDelete(booking)} style={{background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0', fontSize: '1rem', lineHeight: '1'}} title="Borrar Reserva">×</button>
                        )}
                      </div>
                      <div className="mini-name">{booking.name}</div>
                      <div className="mini-room">{booking.room}</div>
                    </div>
                  ))
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
    <div className="glass-panel" style={{display: 'flex', flexDirection: 'column'}}>
      <div className="header calendar-main-header">
        <h2 className="title" style={{margin: 0}}>{headerText}</h2>
        <div className="calendar-controls">
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
        <div style={{textAlign: 'center', padding: '2rem'}}>Cargando...</div>
      ) : (
        viewMode === 'month' ? renderMonthView() : renderWeekView()
      )}
    </div>
  );
}
