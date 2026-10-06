// api/whatsapp.js
export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Puedes restringirlo al dominio de tu app en producción
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Si es una petición OPTIONS (preflight CORS), responder OK
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Ignorar si no es JSON válido
      }
    }

    const { message, chatId, idMessage, urlFile, fileName, caption } = body || {};

    if (!message && !urlFile && !caption) {
      return res.status(400).json({ error: 'Falta el cuerpo del mensaje o archivo' });
    }

    // Credenciales activas y verificadas de Green API
    const ACTIVE_ID = "710722752167";
    const ACTIVE_TOKEN = "1df6e87131a041749acfc26418ccb66657ccd142c4094a9eb0";

    // Si la variable en Vercel tiene el token viejo o corrupto de la instancia eliminada, forzar las credenciales válidas
    let idInstance = process.env.GREEN_API_ID || ACTIVE_ID;
    let apiTokenInstance = process.env.GREEN_API_TOKEN || ACTIVE_TOKEN;

    if (idInstance === ACTIVE_ID || !apiTokenInstance || apiTokenInstance.startsWith("10d56cb7")) {
      idInstance = ACTIVE_ID;
      apiTokenInstance = ACTIVE_TOKEN;
    }

    // Si no pasan un chatId por el body, usamos el de partidas por defecto
    const targetChatId = chatId || process.env.GREEN_API_CHAT_ID || "120363339095444763@g.us";

    let methodPath;
    let payload;

    if (urlFile) {
      methodPath = 'sendFileByUrl';
      payload = {
        chatId: targetChatId,
        urlFile: urlFile,
        fileName: fileName || 'pakito.jpg',
        caption: caption || message || ''
      };
    } else {
      methodPath = idMessage ? 'editMessage' : 'sendMessage';
      payload = {
        chatId: targetChatId,
        message: message
      };
      if (idMessage) {
        payload.idMessage = idMessage;
      }
    }

    const url = `https://api.green-api.com/waInstance${idInstance}/${methodPath}/${apiTokenInstance}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { error: rawText };
    }

    if (!response.ok) {
      console.error(`Error de Green API (${methodPath}):`, data);
      return res.status(response.status).json({ error: `Error en Green API (${methodPath})`, details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Excepción en /api/whatsapp:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
