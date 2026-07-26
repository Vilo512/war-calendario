import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Función para limpiar la clave privada de Firebase
const parsePrivateKey = (key) => {
  if (!key) return undefined;
  let cleanKey = key.trim();
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1);
  }
  return cleanKey.replace(/\\n/g, '\n');
};

function getDb() {
  if (!getApps().length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(`Configuración de Firebase incompleta en Vercel. Faltan variables: projectId=${!!projectId}, clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`);
      }
      
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      });
    }
  }
  return getFirestore();
}

// Escapar texto según especificación iCal RFC 5545
const escapeICalText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

// Formatear fecha a YYYYMMDDTHHmmssZ
const formatICalDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { room } = req.query;

  try {
    const db = getDb();
    let queryRef = db.collection('bookings');

    
    if (room && room !== 'Todas' && room !== 'ALL') {
      queryRef = queryRef.where('room', '==', room);
    }

    const snapshot = await queryRef.get();
    
    let icalContent = "BEGIN:VCALENDAR\r\n";
    icalContent += "VERSION:2.0\r\n";
    icalContent += "PRODID:-//Asociacion Los Cuervos//WAR Calendario//ES\r\n";
    icalContent += "CALSCALE:GREGORIAN\r\n";
    icalContent += "METHOD:PUBLISH\r\n";
    icalContent += `X-WR-CALNAME:${escapeICalText(`WAR Calendario${room && room !== 'Todas' && room !== 'ALL' ? ' - ' + room : ''}`)}\r\n`;
    icalContent += "X-PUBLISHED-TTL:PT1H\r\n";
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

      const eventTitle = escapeICalText(data.name || data.title || "Reserva WAR");
      const roomName = escapeICalText(data.room || "Sala Principal");
      const attendeesList = escapeICalText((data.attendees || []).map(a => a.name || a.email).join(', ') || 'N/A');

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

    // Enviar headers correctos para suscripción WebCal (sin attachment disposition para evitar rechazos en iOS)
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(icalContent);

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: error.stack 
    });
  }
}

