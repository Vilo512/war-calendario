import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function CalendarView() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const q = query(collection(db, 'bookings'), orderBy('time', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (data.length === 0) {
          setBookings([
            { id: '1', name: 'Sesión de Retrato', room: 'Estudio A', time: '10:00' },
            { id: '2', name: 'Grabación Podcast', room: 'Estudio B', time: '14:30' },
            { id: '3', name: 'Reunión de Equipo', room: 'Sala Conferencias', time: '16:00' }
          ]);
        } else {
          setBookings(data);
        }
        setLoading(false);
      }, (error) => {
        console.error("Firestore Error:", error);
        setBookings([
          { id: '1', name: 'Sesión de Retrato', room: 'Estudio A', time: '10:00' },
          { id: '2', name: 'Grabación Podcast', room: 'Estudio B', time: '14:30' },
        ]);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch(err) {
      console.log(err);
      setLoading(false);
    }
  }, []);

  return (
    <div className="glass-panel">
      <div className="header">
        <h2 className="title" style={{margin: 0, fontSize: '1.5rem'}}>Agenda de Hoy</h2>
        <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>19 Julio</div>
      </div>
      
      {loading ? (
        <div style={{textAlign: 'center', padding: '2rem'}}>Cargando...</div>
      ) : (
        <div className="calendar-grid">
          {bookings.map((booking) => (
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
              <div className="booking-time">
                {booking.time}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
