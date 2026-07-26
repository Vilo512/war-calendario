# Documento de Handover - W.A.R. (Wargames and Rol Lleida)

**Fecha de actualización**: 26 de Julio de 2026  
**Estado del Proyecto**: ✅ **100% Funcional, Compilado y Desplegado en Producción**  
**Despliegue Firebase Hosting (Frontend)**: [https://war-calendario.web.app/](https://war-calendario.web.app/)  
**Despliegue Vercel Serverless (API iCal Feed en vivo)**: [https://war-calendario.vercel.app/api/ical](https://war-calendario.vercel.app/api/ical)  
**Repositorio GitHub**: [https://github.com/Vilo512/war-calendario.git](https://github.com/Vilo512/war-calendario.git) (Rama `main` al día)  

---

## 📐 1. Resumen de Arquitectura y Tecnologías

- **Frontend**: React (Vite) + Vanilla CSS + PWA (Progressive Web App con Service Worker y Manifest).
- **Backend / Base de Datos**: Firebase Authentication + Firestore (Colecciones en tiempo real).
- **Servidor de Sincronización WebCal / iCal en Vivo**: Vercel Serverless Function (`api/ical.js`).
- **Estética & Diseño**: 
  - Identidad de Marca: **W.A.R.** (*Wargames and Rol Lleida*).
  - Táctica / Esténcil militar en blanco y negro (Saira Stencil One + Outfit font).
  - Logo circular realzado en el header.
  - Marca de agua SVG en background con opacidad ~9% y paneles translúcidos glassmorphism.
  - Responsivo optimizado para móviles (iPhone SE 375x667).

---

## 🗄️ 2. Estructura de Colecciones en Firestore

1. **`users`**: `{ uid, email, displayName, role (0: No socio, 1: Semisocio, 2: Socio, 9: Admin) }`
2. **`rooms`**: `{ name, capacity, active }`
3. **`bookings`**: `{ name, date (YYYY-MM-DD), startTimeStr (HH:mm), endTimeStr (HH:mm), room, createdBy, attendees: [{uid, name}], maxAttendees }`
4. **`cleaning_schedule/config`**: `{ members: [{id, name, type, uid}], currentWeekIndex }`
5. **`cleaning_history`**: `{ weekId, weekRange, memberId, memberName, isManual, completedAt, completedByUid, completedByName }`
6. **`cleaning_swaps`**: Solicitudes de cambio de turno de limpieza entre socios.
7. **`cleaning_incidents`**: Reportes de faltas o problemas en el turno de limpieza.
8. **`announcements`**: Comunicados oficiales (`title`, `content`, `priority`, `durationDays`, `expiresAt`, `createdAt`).
9. **`config/role_labels`**: Personalización de los nombres de los 4 estatus/roles.

---

## 🛠️ 3. Componentes Principales

- `src/App.jsx`: Componente raíz con header de la marca W.A.R., barra de usuario pasiva estricta, botones de acción y visualización general.
- `src/components/CalendarView.jsx`: Vista del calendario (Modo Mes y Modo Semana), filtro por salas, ocupación dinámica y sincronización iCal.
- `src/components/BookingModal.jsx`: Modal de creación de reservas con validación de solapamiento en tiempo real.
- `src/components/CleaningCard.jsx`: Tarjeta del turno de limpieza con icono de escoba, badge antidesbordamiento, acciones apilables en pantalla estrecha y sincronización dinámica con el histórico.
- `src/components/CleaningHistoryModal.jsx`: Modal de consulta cronológica del histórico de limpiezas completadas con buscador en tiempo real.
- `src/components/AdminPanel.jsx`: Panel de administración con 5 pestañas (Usuarios, Cuadrante Limpieza + Validación, Incidencias, Anuncios, Salas + Purga).
- `src/services/cleaningHistoryService.js`: Servicio desacoplado para gestionar las lecturas y registros en `cleaning_history`.

---

## 🔒 4. Reglas de Backup y Checkpoints

- **Regla del Proyecto**: Cada vez que se solicite un Handover o finalice un bloque relevante, se realiza un git commit y push a la rama `main` de GitHub como punto de restauración inmutable.
- **Commit Actual**: `8a736eb` ("Checkpoint: Bloques 1, 2 y 3 + Historico de Limpieza + Regla Backup").
