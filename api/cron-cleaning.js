// api/cron-cleaning.js
// Disparador programado y webhook autónomo para recordatorios dominicales de limpieza W.A.R.

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyDVQRsvFqbldHEWGt-KZXUCsWu_uldiwq8";
const BOT_EMAIL = process.env.BOT_EMAIL || "bot@warcalendario.com";
const BOT_PASSWORD = process.env.BOT_PASSWORD || "WarBot2026!Cleaning";

const GREEN_ID = "710722752167";
const GREEN_TOKEN = "1df6e87131a041749acfc26418ccb66657ccd142c4094a9eb0";
const DEFAULT_CLEANING_CHAT_ID = "120363413772081898@g.us";
const APP_URL = process.env.APP_URL || "https://warlendario.vercel.app";

async function getFirebaseToken() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: BOT_EMAIL,
      password: BOT_PASSWORD,
      returnSecureToken: true
    })
  });
  if (!authRes.ok) {
    const err = await authRes.json();
    throw new Error('Firebase Auth error: ' + JSON.stringify(err));
  }
  const authData = await authRes.json();
  return authData.idToken;
}

async function getFirestoreDoc(docPath, token) {
  const url = `https://firestore.googleapis.com/v1/projects/war-calendario/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error leyendo ${docPath}: ` + JSON.stringify(err));
  }
  const data = await res.json();
  return parseFirestoreFields(data.fields || {});
}

async function patchFirestoreDoc(docPath, rawFields, token) {
  const fieldPaths = Object.keys(rawFields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/war-calendario/databases/(default)/documents/${docPath}?${fieldPaths}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: toFirestoreFields(rawFields)
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error actualizando ${docPath}: ` + JSON.stringify(err));
  }
  return await res.json();
}

function parseFirestoreFields(fields) {
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
    else if (val.integerValue !== undefined) result[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) result[key] = Number(val.doubleValue);
    else if (val.timestampValue !== undefined) result[key] = val.timestampValue;
    else if (val.arrayValue !== undefined) {
      result[key] = (val.arrayValue.values || []).map(v => {
        if (v.mapValue) return parseFirestoreFields(v.mapValue.fields || {});
        if (v.stringValue !== undefined) return v.stringValue;
        return v;
      });
    } else if (val.mapValue !== undefined) {
      result[key] = parseFirestoreFields(val.mapValue.fields || {});
    }
  }
  return result;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      fields[key] = { integerValue: String(val) };
    } else if (val instanceof Date) {
      fields[key] = { timestampValue: val.toISOString() };
    } else if (val && typeof val === 'object') {
      fields[key] = { timestampValue: new Date().toISOString() };
    }
  }
  return fields;
}

async function sendWhatsAppMessage(chatId, message) {
  const url = `https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error('Error Green API: ' + JSON.stringify(data));
  }
  return data;
}

function calculateCurrentMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function calculateNextMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff + 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatNextWeekRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mDay = String(monday.getDate()).padStart(2, '0');
  const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
  const sDay = String(sunday.getDate()).padStart(2, '0');
  const sMonth = String(sunday.getMonth() + 1).padStart(2, '0');
  return `Lun ${mDay}/${mMonth} - Dom ${sDay}/${sMonth}`;
}

async function handlePendingCheck(token) {
  const currentMonday = calculateCurrentMonday();
  const yyyy = currentMonday.getFullYear();
  const mm = String(currentMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(currentMonday.getDate()).padStart(2, '0');
  const currentWeekId = `${yyyy}-${mm}-${dd}`;

  const weekData = await getFirestoreDoc(`cleaning_schedule/${currentWeekId}`, token);

  // 1. Si ya está completada, silencio
  if (weekData && weekData.completed) {
    return { status: 'skipped', reason: 'Limpieza ya completada', weekId: currentWeekId };
  }

  // 2. Si ya se envió la alerta de pendiente, evitar duplicados
  if (weekData && weekData.pendingAlertSent) {
    return { status: 'skipped', reason: 'Aviso pendiente ya enviado previamente', weekId: currentWeekId };
  }

  const configData = await getFirestoreDoc('cleaning_schedule/config', token);
  if (!configData || !configData.members || configData.members.length === 0) {
    return { status: 'error', reason: 'No hay miembros configurados' };
  }

  const members = configData.members;
  const cleaningChatId = configData.cleaningChatId || DEFAULT_CLEANING_CHAT_ID;

  let currentAssignee = null;
  if (weekData && weekData.assigneeName) {
    currentAssignee = {
      id: weekData.assigneeId,
      name: weekData.assigneeName
    };
  } else {
    const startDate = configData.startDate ? new Date(configData.startDate) : new Date();
    const startMon = calculateCurrentMonday(startDate);
    const diffDays = Math.floor((currentMonday.getTime() - startMon.getTime()) / (1000 * 3600 * 24));
    const weeksPassed = Math.floor(diffDays / 7);
    const currentIndex = ((weeksPassed % members.length) + members.length) % members.length;
    currentAssignee = members[currentIndex];
  }

  if (!currentAssignee) {
    return { status: 'error', reason: 'No se pudo determinar socio' };
  }

  const completeUrl = `${APP_URL}/?action=complete_cleaning&weekId=${currentWeekId}`;
  const groupMsg = `⚠️ *${currentAssignee.name}* no ha marcado que la limpieza haya sido completada.\n\nEn caso de que ya la hayas realizado y se te haya olvidado registrarla en la web:\n\n🔗 *Finalizar Limpieza:*\n${completeUrl}\n\n_(Nota: Por seguridad, al abrir el enlace únicamente el socio encargado con su usuario o un administrador podrán validar y registrar la finalización)._`;

  await sendWhatsAppMessage(cleaningChatId, groupMsg);

  await patchFirestoreDoc(`cleaning_schedule/${currentWeekId}`, {
    pendingAlertSent: true,
    pendingAlertSentAt: new Date(),
    assigneeName: currentAssignee.name,
    assigneeId: currentAssignee.id || ''
  }, token);

  return { status: 'sent', weekId: currentWeekId, assignee: currentAssignee.name, type: 'pending' };
}

async function handleReminder(token) {
  const nextMonday = calculateNextMonday();
  const yyyy = nextMonday.getFullYear();
  const mm = String(nextMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(nextMonday.getDate()).padStart(2, '0');
  const nextWeekId = `${yyyy}-${mm}-${dd}`;
  const nextWeekRange = formatNextWeekRange(nextMonday);

  const weekData = await getFirestoreDoc(`cleaning_schedule/${nextWeekId}`, token);

  if (weekData && weekData.announcedOnWhatsApp) {
    return { status: 'skipped', reason: 'Turno ya anunciado previamente', weekId: nextWeekId };
  }

  const configData = await getFirestoreDoc('cleaning_schedule/config', token);
  if (!configData || !configData.members || configData.members.length === 0) {
    return { status: 'error', reason: 'No hay miembros configurados' };
  }

  const members = configData.members;
  const cleaningChatId = configData.cleaningChatId || DEFAULT_CLEANING_CHAT_ID;

  let nextAssignee = null;
  if (weekData && weekData.assigneeName) {
    nextAssignee = {
      id: weekData.assigneeId,
      name: weekData.assigneeName
    };
  } else {
    const startDate = configData.startDate ? new Date(configData.startDate) : new Date();
    const startMon = calculateCurrentMonday(startDate);
    const diffDays = Math.floor((nextMonday.getTime() - startMon.getTime()) / (1000 * 3600 * 24));
    const weeksPassed = Math.floor(diffDays / 7);
    const currentIndex = ((weeksPassed % members.length) + members.length) % members.length;
    nextAssignee = members[currentIndex];
  }

  if (!nextAssignee) {
    return { status: 'error', reason: 'No se pudo determinar socio' };
  }

  const completeUrl = `${APP_URL}/?action=complete_cleaning&weekId=${nextWeekId}`;
  const groupMsg = `👤 *Socio Encargado:* *${nextAssignee.name}*\n📅 *Semana:* ${nextWeekRange}\n\n🔗 *Finalizar Limpieza:*\n${completeUrl}\n\n_(Nota: Por seguridad, al abrir el enlace únicamente el socio encargado con su usuario o un administrador podrán validar y registrar la finalización)._`;

  await sendWhatsAppMessage(cleaningChatId, groupMsg);

  await patchFirestoreDoc(`cleaning_schedule/${nextWeekId}`, {
    announcedOnWhatsApp: true,
    announcedAt: new Date(),
    assigneeName: nextAssignee.name,
    assigneeId: nextAssignee.id || '',
    weekRange: nextWeekRange
  }, token);

  return { status: 'sent', weekId: nextWeekId, assignee: nextAssignee.name, type: 'reminder' };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const type = req.query.type || (req.body && req.body.type) || 'auto';
    const token = await getFirebaseToken();

    let result = {};

    if (type === 'pending') {
      result = await handlePendingCheck(token);
    } else if (type === 'reminder') {
      result = await handleReminder(token);
    } else {
      // Modo auto (evalúa la hora actual en Madrid)
      const madridHour = new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid", hour: "numeric", hour12: false });
      const currentHour = parseInt(madridHour, 10);

      if (currentHour >= 17 && currentHour < 20) {
        result = await handlePendingCheck(token);
      } else if (currentHour >= 20 || currentHour < 17) {
        result = await handleReminder(token);
      }
    }

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error en /api/cron-cleaning:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
