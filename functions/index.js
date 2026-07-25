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
