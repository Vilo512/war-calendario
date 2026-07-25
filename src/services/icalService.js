import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

// Formatear fecha a YYYYMMDDTHHmmssZ
const formatICalDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

/**
 * Genera contenido .ics a partir de una lista filtrada de reservas
 */
export const generateICalFromBookings = (bookingsList = [], title = "WAR Calendario") => {
  let icalContent = "BEGIN:VCALENDAR\r\n";
  icalContent += "VERSION:2.0\r\n";
  icalContent += "PRODID:-//WAR Calendario//ES\r\n";
  icalContent += "CALSCALE:GREGORIAN\r\n";
  icalContent += "METHOD:PUBLISH\r\n";
  icalContent += `X-WR-CALNAME:${title}\r\n`;

  bookingsList.forEach(data => {
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

    const eventTitle = data.name || data.title || "Reserva WAR";
    const room = data.room || "Sala Principal";
    const attendeesList = (data.attendees || []).map(a => a.name || a.email).join(', ') || 'N/A';

    icalContent += "BEGIN:VEVENT\r\n";
    icalContent += `UID:${data.id || Math.random().toString(36).substring(2)}@warcalendario.com\r\n`;
    icalContent += `DTSTAMP:${formatICalDate(new Date())}\r\n`;
    icalContent += `DTSTART:${formatICalDate(startTime)}\r\n`;
    icalContent += `DTEND:${formatICalDate(endTime)}\r\n`;
    icalContent += `SUMMARY:${eventTitle} (${room})\r\n`;
    icalContent += `LOCATION:Asociación WAR - ${room}\r\n`;
    icalContent += `DESCRIPTION:Reserva en ${room}. Asistentes: ${attendeesList}\r\n`;
    icalContent += "END:VEVENT\r\n";
  });

  icalContent += "END:VCALENDAR\r\n";
  return icalContent;
};

/**
 * Descarga archivo .ics para iCal, iPhone, Outlook y Google Calendar
 */
export const downloadICalFromBookings = (bookingsList = [], filename = "reservas_war.ics") => {
  const content = generateICalFromBookings(bookingsList);
  if (!content) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // En iOS (iPhone / Safari), la Data URI abre directamente la pantalla nativa de Apple Calendario
    const dataUri = 'data:text/calendar;charset=utf8,' + encodeURIComponent(content);
    window.location.href = dataUri;
  } else {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const downloadICalFeed = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "bookings"));
    const list = [];
    querySnapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
    downloadICalFromBookings(list, 'reservas_totales_war.ics');
  } catch (error) {
    console.error("Error al descargar iCal feed:", error);
  }
};
