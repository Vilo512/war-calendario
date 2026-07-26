import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

// Función para limpiar la clave privada de Firebase
const parsePrivateKey = (key) => {
  if (!key) return undefined;
  let cleanKey = key.trim();
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1);
  }
  return cleanKey.replace(/\\n/g, '\n');
};

const adminApp = admin.apps ? admin : (admin.default || admin);

function getDb() {
  if (!adminApp.apps || !adminApp.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      adminApp.initializeApp({ credential: adminApp.credential.cert(serviceAccount) });
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(`Configuración de Firebase incompleta en Vercel. Faltan variables: projectId=${!!projectId}, clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`);
      }
      
      adminApp.initializeApp({
        credential: adminApp.credential.cert({ projectId, clientEmail, privateKey })
      });
    }
  }
  return adminApp.firestore();
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

// Formatear fecha a YYYYMMDDTHHmmssZ para iCal
const formatICalDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Parsear fecha y hora de forma ultra-robusta (soporta guiones y dos puntos en las horas)
const parseDate = (dateStr, timeStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = String(dateStr).split(/[-/]/).map(Number);
  let hours = 10, minutes = 0;
  if (timeStr) {
    const parts = String(timeStr).split(/[-:]/).map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) hours = parts[0];
    if (parts.length >= 2 && !isNaN(parts[1])) minutes = parts[1];
  }
  const d = new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? new Date() : d;
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
      
      const startTime = parseDate(data.date, data.startTimeStr || data.time);
      const endTime = data.endTimeStr ? parseDate(data.date, data.endTimeStr) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);


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

