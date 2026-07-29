import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ROLES, isAdminRole } from '../utils/roleUtils';

export default function AnalyticsPage({ user, userRole }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    // Redirigir si no es admin (esperar a que userRole cargue)
    if (userRole !== undefined && !isAdminRole(userRole)) {
      window.location.href = '/';
    }
  }, [userRole]);

  useEffect(() => {
    if (isAdminRole(userRole)) {
      fetchBookings();
    }
  }, [selectedMonth, selectedYear, userRole]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'bookings'));
      const snapshot = await getDocs(q);
      
      const targetPrefix = `${selectedYear}-${selectedMonth}`;
      const filtered = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.date && String(data.date).startsWith(targetPrefix)) {
          filtered.push({ id: docSnap.id, ...data });
        }
      });
      
      setBookings(filtered);
    } catch (err) {
      console.error("Error obteniendo reservas para analíticas:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminRole(userRole)) {
    return null; // El useEffect redirigirá
  }

  // --- CÁLCULOS ANALÍTICOS ---
  const totalEvents = bookings.length;
  let totalHours = 0;
  
  const roomStats = {};
  const dayStats = {
    'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 
    'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0
  };

  bookings.forEach(b => {
    // Calcular horas
    if (b.startTime && b.endTime) {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      const diffHours = (eh + em/60) - (sh + sm/60);
      if (diffHours > 0) totalHours += diffHours;
    }

    // Calcular por sala
    if (b.roomId) {
      roomStats[b.roomId] = (roomStats[b.roomId] || 0) + 1;
    }

    // Calcular por día de la semana
    if (b.date) {
      const d = new Date(b.date);
      // getDay: 0 = Dom, 1 = Lun...
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = days[d.getDay()];
      dayStats[dayName] = dayStats[dayName] + 1;
    }
  });

  // Normalizar datos para los gráficos
  const maxRoomValue = Math.max(...Object.values(roomStats), 1);
  const maxDayValue = Math.max(...Object.values(dayStats), 1);

  const roomEntries = Object.entries(roomStats).sort((a, b) => b[1] - a[1]);
  const dayEntries = [
    { name: 'Lunes', count: dayStats['Lunes'] },
    { name: 'Martes', count: dayStats['Martes'] },
    { name: 'Miércoles', count: dayStats['Miércoles'] },
    { name: 'Jueves', count: dayStats['Jueves'] },
    { name: 'Viernes', count: dayStats['Viernes'] },
    { name: 'Sábado', count: dayStats['Sábado'] },
    { name: 'Domingo', count: dayStats['Domingo'] }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem', paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="title" style={{ margin: 0 }}>📊 Panel de Analíticas</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select 
            className="form-input" 
            style={{ width: 'auto', padding: '0.4rem' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
              <option key={m} value={m}>{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i]}</option>
            ))}
          </select>
          <select 
            className="form-input" 
            style={{ width: 'auto', padding: '0.4rem' }}
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
          >
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Cargando analíticas...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Tarjetas de Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid var(--accent-primary)' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-primary)' }}>{totalEvents}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Total Partidas/Eventos</div>
            </div>
            
            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #34d399' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#34d399' }}>{Math.round(totalHours)}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Horas Totales Reservadas</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#f59e0b', minHeight: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {roomEntries.length > 0 ? roomEntries[0][0].replace(/_/g, ' ') : 'N/A'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Sala Más Usada</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {/* Gráfico de Afluencia por Días */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Afluencia por Día de la Semana</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {dayEntries.map((day, idx) => {
                  const percentage = (day.count / maxDayValue) * 100;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '80px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {day.name}
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: '24px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ 
                          width: `${percentage}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, var(--accent-secondary), var(--accent-primary))',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                        {day.count > 0 && (
                          <span style={{ position: 'absolute', right: '8px', top: '2px', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>
                            {day.count}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfico de Uso por Salas */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Ocupación por Salas</h3>
              
              {roomEntries.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
                  No hay datos de salas en este periodo.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {roomEntries.map(([roomName, count], idx) => {
                    const percentage = (count / maxRoomValue) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '120px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {roomName.replace(/_/g, ' ')}
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: '24px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ 
                            width: `${percentage}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, #10b981, #34d399)',
                            borderRadius: '4px',
                            transition: 'width 0.5s ease'
                          }} />
                          <span style={{ position: 'absolute', right: '8px', top: '2px', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>
                            {count} res.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
      <footer style={{ textAlign: 'center', padding: '2rem 1rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.7 }}>
        WAR Calendario - v1.0.0
      </footer>
    </div>
  );
}
