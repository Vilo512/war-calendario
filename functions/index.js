const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Formatear fecha a YYYYMMDDTHHmmssZ
const formatICalDate = (date) => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

exports.getICalFeed = onRequest(async (req, res) => {
  try {
    const roomParam = req.query.room;
    let reservationsQuery = db.collection("bookings");

    if (roomParam && roomParam !== 'ALL') {
      reservationsQuery = reservationsQuery.where("room", "==", roomParam);
    }

    const snapshot = await reservationsQuery.get();

    const calTitle = roomParam && roomParam !== 'ALL' ? `Reservas WAR - ${roomParam}` : "Reservas WAR (Todas las salas)";

    let icalContent = "BEGIN:VCALENDAR\r\n";
    icalContent += "VERSION:2.0\r\n";
    icalContent += "PRODID:-//WAR Calendario//ES\r\n";
    icalContent += "CALSCALE:GREGORIAN\r\n";
    icalContent += "METHOD:PUBLISH\r\n";
    icalContent += `X-WR-CALNAME:${calTitle}\r\n`;

    snapshot.forEach(doc => {
      const data = doc.data();
      let startTime = new Date();
      if (data.date && data.startTimeStr) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hours, minutes] = data.startTimeStr.split(':').map(Number);
        startTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      } else if (data.date && data.time) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hours, minutes] = data.time.split(':').map(Number);
        startTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      } else if (data.startTime) {
        startTime = data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime);
      }

      let endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
      if (data.date && data.endTimeStr) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hours, minutes] = data.endTimeStr.split(':').map(Number);
        endTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      } else if (data.endTime) {
        endTime = data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime);
      }

      const title = data.name || data.gameTitle || data.title || "Reserva";
      const room = data.room || "Sala Principal";
      
      icalContent += "BEGIN:VEVENT\r\n";
      icalContent += `UID:${doc.id}@warcalendario.com\r\n`;
      icalContent += `DTSTAMP:${formatICalDate(new Date())}\r\n`;
      icalContent += `DTSTART:${formatICalDate(startTime)}\r\n`;
      icalContent += `DTEND:${formatICalDate(endTime)}\r\n`;
      icalContent += `SUMMARY:${title} (${room})\r\n`;
      icalContent += `LOCATION:Asociación WAR - ${room}\r\n`;
      icalContent += "END:VEVENT\r\n";
    });

    icalContent += "END:VCALENDAR\r\n";

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reservas.ics"'
    });
    
    res.status(200).send(icalContent);
  } catch (error) {
    console.error("Error generating iCal feed:", error);
    res.status(500).send("Error generando feed iCal.");
  }
});

// ==========================================
// AVISOS AUTOMÁTICOS DE LIMPIEZA (DOMINGOS 19:00)
// ==========================================
const { onSchedule } = require("firebase-functions/v2/scheduler");

const DEFAULT_SALT = 'WAR_LLEIDA_CLEANING_SALT_2026';
const FALLBACK_SECRET = 'WAR_CLEANING_SEC_KEY_8f93b1d2e4a5c6';
const GREEN_API_ID = process.env.GREEN_API_ID || "710722696080";
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || "10d56cb75a914e1fa5645eaa9ebc038b704f1e1a0c5947e9ae";
const APP_URL = "https://warcalendario.web.app";

async function decryptPhone(encryptedObj) {
  if (!encryptedObj || !encryptedObj.ciphertext || !encryptedObj.iv) return null;
  try {
    const enc = new TextEncoder();
    const km = await crypto.subtle.importKey(
      'raw',
      enc.encode(process.env.ADMIN_ENCRYPTION_KEY || FALLBACK_SECRET),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(DEFAULT_SALT), iterations: 100000, hash: 'SHA-256' },
      km,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const ivBytes = new Uint8Array(Buffer.from(encryptedObj.iv, 'base64'));
    const cipherBytes = new Uint8Array(Buffer.from(encryptedObj.ciphertext, 'base64'));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      cipherBytes
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Error descifrando teléfono en cloud function:", e);
    return null;
  }
}

async function sendGreenAPIMessage(chatId, message) {
  const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });
  return response.json();
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

async function executeSundayCleaningReminder() {
  const nextMonday = calculateNextMonday();
  const yyyy = nextMonday.getFullYear();
  const mm = String(nextMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(nextMonday.getDate()).padStart(2, '0');
  const nextWeekId = `${yyyy}-${mm}-${dd}`;
  const nextWeekRange = formatNextWeekRange(nextMonday);

  // 1. Obtener documento de la próxima semana para comprobar si ya se anunció o hay override
  const weekDocSnap = await db.collection('cleaning_schedule').doc(nextWeekId).get();
  const weekData = weekDocSnap.exists ? weekDocSnap.data() : null;

  if (weekData && weekData.announcedOnWhatsApp) {
    console.log(`El recordatorio para la semana ${nextWeekId} ya fue enviado previamente.`);
    return { alreadySent: true, weekId: nextWeekId };
  }

  // 2. Obtener config global del cuadrante
  const configSnap = await db.collection('cleaning_schedule').doc('config').get();
  if (!configSnap.exists) {
    console.warn("No existe el documento de configuración cleaning_schedule/config.");
    return { error: 'No config found' };
  }

  const configData = configSnap.data();
  const members = configData.members || [];
  const cleaningChatId = configData.cleaningChatId || null;

  if (members.length === 0) {
    console.warn("No hay miembros configurados en la lista de limpieza.");
    return { error: 'No members in cleaning schedule' };
  }

  // 3. Determinar socio asignado
  let nextAssignee = null;
  if (weekData && weekData.assigneeName) {
    nextAssignee = {
      id: weekData.assigneeId,
      name: weekData.assigneeName,
      isManual: weekData.isManual || false
    };
  } else {
    const startDate = configData.startDate?.toDate ? configData.startDate.toDate() : new Date();
    // Calcular semanas de diferencia
    const startMon = new Date(startDate);
    const sDay = startMon.getDay();
    startMon.setDate(startMon.getDate() - sDay + (sDay === 0 ? -6 : 1));
    startMon.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((nextMonday.getTime() - startMon.getTime()) / (1000 * 3600 * 24));
    const weeksPassed = Math.floor(diffDays / 7);
    const currentIndex = ((weeksPassed % members.length) + members.length) % members.length;
    nextAssignee = members[currentIndex];
  }

  if (!nextAssignee) {
    console.warn("No se pudo determinar el socio asignado para la semana entrante.");
    return { error: 'No assignee determined' };
  }

  // 4. Buscar teléfono cifrado si existe
  let decryptedPhone = null;
  if (nextAssignee.id && !nextAssignee.isManual) {
    const phoneSnap = await db.collection('admin_phone_book').doc(nextAssignee.id).get();
    if (phoneSnap.exists) {
      decryptedPhone = await decryptPhone(phoneSnap.data());
    }
  }

  // 5. Enviar mensaje al canal grupal si está configurado
  if (cleaningChatId && cleaningChatId.trim()) {
    try {
      const groupMsg = `🧹 *[TURNO DE LIMPIEZA - W.A.R. LLEIDA]*\n📅 *Semana entrante:* ${nextWeekRange}\n👤 *Socio encargado:* ${nextAssignee.name}\n\nRecordamos que la semana entrante este es el turno asignado para el mantenimiento y limpieza del local de la asociación W.A.R. Lleida.\nSi necesitas gestionar una permuta de turno, puedes hacerlo desde el cuadrante en la web:\n🔗 ${APP_URL}`;
      await sendGreenAPIMessage(cleaningChatId.trim(), groupMsg);
      console.log(`Mensaje grupal enviado al canal ${cleaningChatId}`);
    } catch (e) {
      console.error("Error enviando mensaje al canal de limpieza:", e);
    }
  }

  // 6. Enviar mensaje privado directo al socio si tiene teléfono
  if (decryptedPhone) {
    try {
      const cleanPhone = String(decryptedPhone).replace(/\D/g, '');
      const completeUrl = `${APP_URL}/?action=complete_cleaning&weekId=${nextWeekId}`;
      const directMsg = `🧹 *[RECORDATORIO DE TURNO DE LIMPIEZA - W.A.R. LLEIDA]*\n¡Hola ${nextAssignee.name}!\n\nTe recordamos que te corresponde el turno de limpieza del local de la asociación W.A.R. Lleida (*${nextWeekRange}*).\n\nCuando hayas realizado y terminado las tareas de limpieza, pulsa en el siguiente enlace para darla por completada en la plataforma:\n🔗 *Finalizar Limpieza:* ${completeUrl}\n\n_(Nota: Por motivos de seguridad, únicamente tú con tu cuenta de usuario o un administrador podéis finalizar esta tarea)._`;
      await sendGreenAPIMessage(`${cleanPhone}@c.us`, directMsg);
      console.log(`WhatsApp privado enviado a ${nextAssignee.name} (${cleanPhone})`);
    } catch (e) {
      console.error("Error enviando WhatsApp privado al socio:", e);
    }
  }

  // 7. Marcar como anunciado en la semana de Firestore
  await db.collection('cleaning_schedule').doc(nextWeekId).set({
    announcedOnWhatsApp: true,
    announcedAt: admin.firestore.FieldValue.serverTimestamp(),
    assigneeName: nextAssignee.name,
    assigneeId: nextAssignee.id || null,
    weekRange: nextWeekRange
  }, { merge: true });

  return { success: true, nextWeekId, assignee: nextAssignee.name, phoneNotified: Boolean(decryptedPhone) };
}

// Disparador programado: Todos los domingos a las 19:00 hora peninsular española
exports.sendSundayCleaningReminder = onSchedule(
  { schedule: "every sunday 19:00", timeZone: "Europe/Madrid" },
  async () => {
    console.log("Ejecutando aviso programado de limpieza dominical...");
    return await executeSundayCleaningReminder();
  }
);

// Disparador HTTP manual para pruebas o webhook
exports.triggerSundayReminder = onRequest(async (req, res) => {
  try {
    const result = await executeSundayCleaningReminder();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error en triggerSundayReminder:", error);
    res.status(500).json({ error: error.message });
  }
});

