import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Reemplaza caracteres de nueva línea escapados (necesario en variables de entorno Vercel)
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      })
    });
  } catch (error) {
    console.error('Firebase Admin initialization error', error.stack);
  }
}

const db = admin.firestore();

// Función auxiliar para formatear la fecha a YYYYMMDDTHHmmssZ
const formatICalDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export default async function handler(req, res) {
  // Manejo de CORS básico (opcional)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Permitir usar un token simple de seguridad por si en el futuro quieren cerrarlo
  // const { token, room } = req.query;
  // if (process.env.CALENDAR_SECRET_TOKEN && token !== process.env.CALENDAR_SECRET_TOKEN) {
  //   return res.status(401).send('Unauthorized');
  // }

  const { room } = req.query; // Captura el parámetro de sala (ej. ?room=Principal)

  try {
    let queryRef = db.collection('bookings');
    
    // Si pasamos un filtro de sala por URL
    if (room && room !== 'Todas') {
      queryRef = queryRef.where('room', '==', room);
    }

    const snapshot = await queryRef.get();
    
    let icalContent = "BEGIN:VCALENDAR\r\n";
    icalContent += "VERSION:2.0\r\n";
    icalContent += "PRODID:-//WAR Calendario//ES\r\n";
    icalContent += "CALSCALE:GREGORIAN\r\n";
    icalContent += "METHOD:PUBLISH\r\n";
    icalContent += `X-WR-CALNAME:WAR Calendario${room && room !== 'Todas' ? ' - ' + room : ''}\r\n`;
    icalContent += "X-PUBLISHED-TTL:PT1H\r\n"; // Sugiere a los clientes que actualicen cada hora
    icalContent += "REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n";

    snapshot.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      
      let startTime = new Date();
      if (data.date && data.startTimeStr) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hours, minutes] = data.startTimeStr.split(':').map(Number);
        startTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      } else if (data.date && data.time) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hours, minutes] = data.time.split(':').map(Number);
        startTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      } else if (data.date) {
        const [year, month, day] = data.date.split('-').map(Number);
        startTime = new Date(year, month - 1, day, 10, 0, 0, 0);
      }

      let endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
      if (data.date && data.endTimeStr) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hours, minutes] = data.endTimeStr.split(':').map(Number);
        endTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      }

      const eventTitle = data.name || data.title || "Reserva WAR";
      const roomName = data.room || "Sala Principal";
      const attendeesList = (data.attendees || []).map(a => a.name || a.email).join(', ') || 'N/A';

      icalContent += "BEGIN:VEVENT\r\n";
      icalContent += `UID:${data.id}@warcalendario.com\r\n`;
      icalContent += `DTSTAMP:${formatICalDate(new Date())}\r\n`;
      icalContent += `DTSTART:${formatICalDate(startTime)}\r\n`;
      icalContent += `DTEND:${formatICalDate(endTime)}\r\n`;
      icalContent += `SUMMARY:${eventTitle} (${roomName})\r\n`;
      icalContent += `LOCATION:Asociación WAR - ${roomName}\r\n`;
      icalContent += `DESCRIPTION:Reserva en ${roomName}. Asistentes: ${attendeesList}\r\n`;
      icalContent += "END:VEVENT\r\n";
    });

    icalContent += "END:VCALENDAR\r\n";

    // Enviar headers para forzar al navegador/cliente a tratarlo como iCal
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="war_calendario${room ? '_' + room : ''}.ics"`);
    res.status(200).send(icalContent);

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
