import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

// Formatear fecha a YYYYMMDDTHHmmssZ
const formatICalDate = (date) => {
  if (!date) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export const generateICalContent = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "bookings"));
    
    let icalContent = "BEGIN:VCALENDAR\r\n";
    icalContent += "VERSION:2.0\r\n";
    icalContent += "PRODID:-//WAR Calendario//ES\r\n";
    icalContent += "CALSCALE:GREGORIAN\r\n";
    icalContent += "METHOD:PUBLISH\r\n";
    icalContent += "X-WR-CALNAME:Reservas WAR\r\n";

    querySnapshot.forEach(doc => {
      const data = doc.data();
      let startTime = new Date();
      if (data.time) {
        const [hours, minutes] = data.time.split(':');
        startTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      } else if (data.startTime && data.startTime.toDate) {
        startTime = data.startTime.toDate();
      }
      
      const endTime = data.endTime && data.endTime.toDate ? data.endTime.toDate() : new Date(startTime.getTime() + 60 * 60 * 1000);
      const title = data.name || data.title || "Reserva";
      const room = data.room || "Sala Principal";
      
      icalContent += "BEGIN:VEVENT\r\n";
      icalContent += `UID:${doc.id}@warcalendario.com\r\n`;
      icalContent += `DTSTAMP:${formatICalDate(new Date())}\r\n`;
      icalContent += `DTSTART:${formatICalDate(startTime)}\r\n`;
      icalContent += `DTEND:${formatICalDate(endTime)}\r\n`;
      icalContent += `SUMMARY:${title}\r\n`;
      icalContent += `LOCATION:${room}\r\n`;
      icalContent += "END:VEVENT\r\n";
    });

    icalContent += "END:VCALENDAR\r\n";
    
    return icalContent;
  } catch (error) {
    console.error("Error al generar iCal:", error);
    return null;
  }
};

export const downloadICalFeed = async () => {
  const content = await generateICalContent();
  if (!content) return;

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', 'reservas.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
