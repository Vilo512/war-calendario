// Utilidades para el cálculo de semanas de lunes a domingo y asignación de limpieza

// Obtener el Lunes de la semana actual a las 00:00:00
export function getMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajustar si es domingo (0)
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Obtener el Domingo de la semana actual a las 23:59:59
export function getSunday(d = new Date()) {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// Formatear rango de fechas "Lunes DD/MM - Domingo DD/MM"
export function formatWeekRange(d = new Date()) {
  const monday = getMonday(d);
  const sunday = getSunday(d);
  
  const mDay = String(monday.getDate()).padStart(2, '0');
  const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
  
  const sDay = String(sunday.getDate()).padStart(2, '0');
  const sMonth = String(sunday.getMonth() + 1).padStart(2, '0');
  
  return `Lun ${mDay}/${mMonth} - Dom ${sDay}/${sMonth}`;
}

// Identificador único de semana (ej: "2026-07-20")
export function getWeekId(d = new Date()) {
  const monday = getMonday(d);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Calcular la diferencia de semanas completas de Lunes entre startDate y targetDate
export function getWeeksDiff(startDate, targetDate = new Date()) {
  const startMonday = getMonday(startDate);
  const targetMonday = getMonday(targetDate);
  const diffTime = targetMonday.getTime() - startMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
  return Math.floor(diffDays / 7);
}

// Determinar el socio asignado para la semana actual
export function calculateCurrentAssignee(membersList = [], startDate = new Date(), overrideIndex = null) {
  if (!membersList || membersList.length === 0) return null;
  
  if (overrideIndex !== null && overrideIndex >= 0 && overrideIndex < membersList.length) {
    return {
      assignee: membersList[overrideIndex],
      index: overrideIndex
    };
  }

  const weeksPassed = getWeeksDiff(startDate, new Date());
  const currentIndex = ((weeksPassed % membersList.length) + membersList.length) % membersList.length;
  
  return {
    assignee: membersList[currentIndex],
    index: currentIndex
  };
}
