import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getMonday, getSunday } from '../utils/cleaningUtils';

function formatDateForQuery(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function getSmartCleaningSuggestion() {
  try {
    const monday = getMonday();
    const sunday = getSunday();
    
    const mondayStr = formatDateForQuery(monday);
    const sundayStr = formatDateForQuery(sunday);

    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', mondayStr),
      where('date', '<=', sundayStr)
    );

    const snapshot = await getDocs(q);
    const bookings = [];
    snapshot.forEach(doc => bookings.push(doc.data()));

    const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    // Initialize day map
    const dayStats = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatDateForQuery(d);
      dayStats[dateStr] = {
        name: daysOfWeek[i],
        date: dateStr,
        count: 0,
        hours: 0
      };
    }

    // Process bookings
    bookings.forEach(b => {
      if (dayStats[b.date]) {
        dayStats[b.date].count++;
        if (b.startTime && b.endTime) {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          const diffHours = (eh + em/60) - (sh + sm/60);
          dayStats[b.date].hours += (diffHours > 0 ? diffHours : 0);
        }
      }
    });

    const statsArray = Object.values(dayStats);
    
    // 1. Buscamos días con 0 reservas
    const zeroBookings = statsArray.filter(d => d.count === 0);
    
    if (zeroBookings.length > 0) {
      if (zeroBookings.length === 7) {
        return "El local no tiene reservas esta semana. Cualquier día es perfecto para limpiar.";
      }
      const daysStr = zeroBookings.map(d => d.name).join(', ').replace(/, ([^,]*)$/, ' y $1');
      return `¡El local está libre! ${daysStr} no hay ninguna reserva programada, ideal para limpiar.`;
    }

    // 2. Si no hay días libres, buscamos los de menor horas ocupadas (bottom 2)
    statsArray.sort((a, b) => a.hours - b.hours);
    const bestDays = statsArray.slice(0, 2);
    
    const bestDaysStr = bestDays.map(d => `${d.name} (~${Math.round(d.hours)}h)`).join(' y ');
    return `La semana está ocupada, pero los días más tranquilos son: ${bestDaysStr}.`;

  } catch (err) {
    console.error("Error generating smart cleaning suggestion:", err);
    return "No se pudo generar la sugerencia (error de conexión).";
  }
}
