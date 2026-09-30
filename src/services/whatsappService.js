// Service for sending WhatsApp messages via Green API directly from frontend or proxy

const GREEN_API_ID = import.meta.env.VITE_GREEN_API_ID || "710722696080";
const GREEN_API_TOKEN = import.meta.env.VITE_GREEN_API_TOKEN || "10d56cb75a914e1fa5645eaa9ebc038b704f1e1a0c5947e9ae";
const GREEN_API_CHAT_ID = import.meta.env.VITE_GREEN_API_CHAT_ID || "120363339095444763@g.us";

export async function sendWhatsAppMessage(message, customChatId = null) {
  const targetChatId = customChatId || GREEN_API_CHAT_ID;

  // Primero intentamos la Serverless function si existe (para Vercel)
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, chatId: targetChatId })
    });

    // Si devuelve JSON con success ok
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (e) {
    console.warn("Serverless /api/whatsapp no disponible, usando llamada directa client-side a Green API...");
  }

  // Fallback directo client-side para Firebase Hosting / estático
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: targetChatId,
        message: message
      })
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error enviando WhatsApp desde el cliente:", err);
    throw err;
  }
}

export async function editWhatsAppMessage(idMessage, message, customChatId = null) {
  if (!idMessage) {
    return sendWhatsAppMessage(message, customChatId);
  }

  const targetChatId = customChatId || GREEN_API_CHAT_ID;

  // Primero intentamos la Serverless function si existe (para Vercel)
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, chatId: targetChatId, idMessage })
    });

    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (e) {
    console.warn("Serverless /api/whatsapp no disponible para edición, usando llamada directa...");
  }

  // Fallback directo client-side para editMessage
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/editMessage/${GREEN_API_TOKEN}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: targetChatId,
        idMessage: idMessage,
        message: message
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.warn("No se pudo editar el mensaje en WhatsApp (posiblemente > 48h):", data);
    }
    return data;
  } catch (err) {
    console.error("Error editando mensaje de WhatsApp:", err);
    return null;
  }
}

export function buildWhatsAppMessageText(booking, overrideAttendees = null) {
  const name = (booking.name || '').replace(' (Fin trasnoche)', '').trim();
  const room = booking.room;
  const activityType = booking.activityType || 'open';
  const targetAudience = booking.targetAudience || 'publico';
  const attendees = overrideAttendees || booking.attendees || [];
  const maxAttendees = booking.maxAttendees || null;
  const appUrl = window.location.origin;

  const activityLabel = activityType === 'closed' ? '🔒 Mesa Cerrada' : '🔓 Actividad Abierta';
  
  let targetLabel = '🌐 Público General';
  if (targetAudience === 'semisocios') targetLabel = '🤝 Socios y Simpatizantes';
  if (targetAudience === 'socios') targetLabel = '⭐ Exclusivo Socios';

  const formatDisplayDateDMY = (isoStr) => {
    if (!isoStr) return '';
    const parts = String(isoStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return String(isoStr);
  };

  const displayDate = formatDisplayDateDMY(booking.date);
  const timeString = booking.fullTimeRange || (booking.startTime && booking.endTime 
    ? `${booking.startTime} a ${booking.endTime}` 
    : (booking.time || ''));

  const countPre = attendees.length;
  const preNamesList = attendees.map(a => a.name).join(', ');
  
  let plazasText = 'Sin límite';
  if (maxAttendees) {
    plazasText = `${countPre}/${maxAttendees} ocupadas${preNamesList ? ` (${preNamesList})` : ''}`;
  } else if (countPre > 0) {
    plazasText = `${countPre} pre-apuntado(s) (${preNamesList})`;
  }

  return `📢 *${name}*\n📅 *${displayDate}* - ⏰ *${timeString}*\n📍 *${room}*\n🎯 *Formato:* ${activityLabel} (${targetLabel})\n👥 *Plazas:* ${plazasText}\n🔗 *Apúntate en la App:* ${appUrl}`;
}

export function buildWhatsAppCancelText(booking) {
  const name = (booking.name || '').replace(' (Fin trasnoche)', '').trim();
  const room = booking.room;

  const formatDisplayDateDMY = (isoStr) => {
    if (!isoStr) return '';
    const parts = String(isoStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return String(isoStr);
  };

  const displayDate = formatDisplayDateDMY(booking.date);
  const timeText = booking.fullTimeRange || (booking.startTime && booking.endTime 
    ? `${booking.startTime} a ${booking.endTime}` 
    : (booking.time || ''));

  return `❌ *[EVENTO CANCELADO]* ❌\n📢 *${name}*\n📅 *${displayDate}* - ⏰ *${timeText}*\n📍 *${room}*\n\n_Este evento ha sido cancelado en el calendario._`;
}

/**
 * Genera el texto del mensaje para el canal grupal de limpieza
 */
export function buildCleaningGroupMessage({ assigneeName, weekRange, appUrl = window.location.origin }) {
  return `🧹 *[TURNO DE LIMPIEZA - W.A.R. LLEIDA]*\n📅 *Semana entrante:* ${weekRange}\n👤 *Socio encargado:* ${assigneeName}\n\nRecordamos que la semana entrante este es el turno asignado para el mantenimiento y limpieza del local de la asociación W.A.R. Lleida.\nSi necesitas gestionar una permuta de turno, puedes hacerlo desde el cuadrante en la web:\n🔗 ${appUrl}`;
}

/**
 * Genera el texto del recordatorio privado directo para el socio asignado
 */
export function buildCleaningDirectMessage({ assigneeName, weekRange, weekId, appUrl = window.location.origin }) {
  const completeUrl = `${appUrl}/?action=complete_cleaning&weekId=${weekId}`;
  return `🧹 *[RECORDATORIO DE TURNO DE LIMPIEZA - W.A.R. LLEIDA]*\n¡Hola ${assigneeName}!\n\nTe recordamos que te corresponde el turno de limpieza del local de la asociación W.A.R. Lleida (*${weekRange}*).\n\nCuando hayas realizado y terminado las tareas de limpieza, pulsa en el siguiente enlace para darla por completada en la plataforma:\n🔗 *Finalizar Limpieza:* ${completeUrl}\n\n_(Nota: Por motivos de seguridad, únicamente tú con tu cuenta de usuario o un administrador podéis finalizar esta tarea)._`;
}

/**
 * Envía un mensaje directo privado a un número de WhatsApp
 */
export async function sendDirectWhatsAppMessage(phoneNumber, message) {
  if (!phoneNumber || !message) {
    throw new Error('Número de teléfono y mensaje son requeridos');
  }
  // Limpiar caracteres no numéricos
  const cleanPhone = String(phoneNumber).replace(/\D/g, '');
  const targetChatId = `${cleanPhone}@c.us`;
  return sendWhatsAppMessage(message, targetChatId);
}

/**
 * Orquestador de envío combinado de recordatorios de limpieza (Canal + Privado)
 */
export async function sendCleaningCombinedReminders({
  weekId,
  weekRange,
  assignee,
  phone = null,
  cleaningChatId = null,
  appUrl = window.location.origin
}) {
  const results = {
    groupSent: false,
    directSent: false,
    errors: []
  };

  const assigneeName = assignee?.name || 'Socio';

  // 1. Enviar al canal grupal de limpieza si está configurado
  if (cleaningChatId && cleaningChatId.trim()) {
    try {
      const groupMsg = buildCleaningGroupMessage({ assigneeName, weekRange, appUrl });
      await sendWhatsAppMessage(groupMsg, cleaningChatId.trim());
      results.groupSent = true;
    } catch (err) {
      console.error('Error enviando anuncio grupal de limpieza:', err);
      results.errors.push(`Error canal grupal: ${err.message}`);
    }
  }

  // 2. Enviar mensaje privado directo al socio si tiene teléfono
  if (phone && phone.trim()) {
    try {
      const directMsg = buildCleaningDirectMessage({ assigneeName, weekRange, weekId, appUrl });
      await sendDirectWhatsAppMessage(phone.trim(), directMsg);
      results.directSent = true;
    } catch (err) {
      console.error('Error enviando WhatsApp privado al socio:', err);
      results.errors.push(`Error WhatsApp privado: ${err.message}`);
    }
  }

  return results;
}

