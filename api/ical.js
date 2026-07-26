import crypto from 'crypto';

// Limpiar la clave privada de Firebase
const parsePrivateKey = (key) => {
  if (!key) return undefined;
  let cleanKey = key.trim();
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1);
  }
  return cleanKey.replace(/\\n/g, '\n');
};

const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

// Generar Access Token de Google mediante OAuth 2.0 JWT nativo (0 dependencias)
async function getGoogleAccessToken(clientEmail, privateKey) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Google OAuth error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Extraer campos de Firestore REST API
function parseFirestoreFields(fields = {}) {
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.integerValue !== undefined) result[key] = Number(val.integerValue);
    else if (val.arrayValue !== undefined) {
      result[key] = (val.arrayValue.values || []).map(v => {
        if (v.mapValue) return parseFirestoreFields(v.mapValue.fields);
        return v.stringValue || '';
      });
    }
  }
  return result;
}

// Consultar reservas mediante Firestore REST API
async function fetchBookingsFromFirestore(projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bookings?pageSize=1000`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Firestore REST HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const documents = data.documents || [];

  return documents.map(doc => {
    const id = doc.name.split('/').pop();
    const parsedFields = parseFirestoreFields(doc.fields);
    return { id, ...parsedFields };
  });
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
    let projectId = process.env.FIREBASE_PROJECT_ID;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      projectId = sa.project_id || projectId;
      clientEmail = sa.client_email || clientEmail;
      privateKey = parsePrivateKey(sa.private_key || privateKey);
    }

    if (!projectId || !clientEmail || !privateKey) {
      return res.status(500).json({
        error: 'Configuración incompleta en Vercel',
        details: `projectId=${!!projectId}, clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`
      });
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    let bookings = await fetchBookingsFromFirestore(projectId, accessToken);

    if (room && room !== 'Todas' && room !== 'ALL') {
      bookings = bookings.filter(b => b.room === room);
    }

    let icalContent = "BEGIN:VCALENDAR\r\n";
    icalContent += "VERSION:2.0\r\n";
    icalContent += "PRODID:-//Asociacion Los Cuervos//WAR Calendario//ES\r\n";
    icalContent += "CALSCALE:GREGORIAN\r\n";
    icalContent += "METHOD:PUBLISH\r\n";
    icalContent += `X-WR-CALNAME:${escapeICalText(`WAR Calendario${room && room !== 'Todas' && room !== 'ALL' ? ' - ' + room : ''}`)}\r\n`;
    icalContent += "X-PUBLISHED-TTL:PT1H\r\n";
    icalContent += "REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n";

    bookings.forEach(data => {
      const startTime = parseDate(data.date, data.startTimeStr || data.time);
      const endTime = data.endTimeStr ? parseDate(data.date, data.endTimeStr) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      const eventTitle = escapeICalText(data.name || data.title || "Reserva WAR");
      const roomName = escapeICalText(data.room || "Sala Principal");
      const attendeesList = escapeICalText((data.attendees || []).map(a => (typeof a === 'object' ? (a.name || a.email) : a)).join(', ') || 'N/A');

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

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(icalContent);

  } catch (error) {
    console.error('Error serving iCal feed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack
    });
  }
}
