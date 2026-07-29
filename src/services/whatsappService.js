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
