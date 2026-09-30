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
    const { message, chatId, idMessage } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Falta el cuerpo del mensaje' });
    }

    // Obtener credenciales de variables de entorno de Vercel
    const idInstance = process.env.GREEN_API_ID || "710722752167";
    const apiTokenInstance = process.env.GREEN_API_TOKEN || "1df6e87131a041749acfc26418ccb66657ccd142c4094a9eb0";
    // Si no pasan un chatId por el body, usamos el de partidas por defecto
    const targetChatId = chatId || process.env.GREEN_API_CHAT_ID || "120363339095444763@g.us";

    if (!idInstance || !apiTokenInstance || !targetChatId) {
      console.error('Faltan credenciales de Green API o Chat ID en las variables de entorno.');
      return res.status(500).json({ error: 'Configuración de servidor incompleta.' });
    }

    // Determinar si enviamos un mensaje nuevo o editamos uno existente
    const methodPath = idMessage ? 'editMessage' : 'sendMessage';
    const url = `https://api.green-api.com/waInstance${idInstance}/${methodPath}/${apiTokenInstance}`;

    // Payload esperado por Green API
    const payload = {
      chatId: targetChatId,
      message: message
    };

    if (idMessage) {
      payload.idMessage = idMessage;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

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
