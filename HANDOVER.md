# Documento de Handover - WAR CALENDARIO (Asociación Los Cuervos)

**Fecha de actualización**: 26 de Julio de 2026  
**Estado del Proyecto**: ✅ **100% Funcional, Compilado y Desplegado en Producción**  
**Despliegue Firebase Hosting**: [https://war-calendario.web.app/](https://war-calendario.web.app/)  
**Repositorio GitHub**: [https://github.com/Vilo512/war-calendario.git](https://github.com/Vilo512/war-calendario.git) (Rama `main` al día)  
**Backup Local**: `d:\Antigravity Projects\WAR Calendario Backup Bloque1`

---

## 📐 1. Resumen de Arquitectura y Tecnologías

- **Frontend**: React (Vite) + Vanilla CSS + PWA (Progressive Web App con Service Worker y Manifest).
- **Backend / Base de Datos**: Firebase Authentication + Firestore (Colecciones en tiempo real).
- **Sincronización iCal**: Generación dinámica en cliente (Data-URI nativo de Apple para Safari iPhone, `.ics` universal y Google Calendar) vía `src/services/icalService.js`.
- **Estética & Diseño**: Táctica / Esténcil militar en blanco y negro (Saira Stencil One + Outfit font), **0% emojis**, con el logo oficial circular en el header y marca de agua SVG al 4% de opacidad centrada en el fondo.

---

## 🗄️ 2. Estructura de Colecciones en Firestore

1. **`users`**: `{ uid, email, displayName, role (0: No socio, 1: Semisocio, 2: Socio, 9: Admin) }`
2. **`rooms`**: `{ name, capacity, active }`
3. **`bookings`**: `{ name, date (YYYY-MM-DD), startTimeStr (HH:mm), endTimeStr (HH:mm), room, createdBy, attendees: [{uid, name}], maxAttendees }`
4. **`cleaning_schedule/config`**: `{ members: [{id, name, type, uid}], currentWeekIndex }`
5. **`cleaning_swaps`**: Solicitudes de cambio de turno de limpieza entre socios.
6. **`cleaning_incidents`**: Reportes de faltas o problemas en el turno de limpieza (`OPEN`, `RESOLVED`, `DISMISSED`).
7. **`announcements`**: Comunicados oficiales (`title`, `content`, `priority: 'NORMAL'|'URGENT'`, `durationDays`, `expiresAt`, `createdAt`).
8. **`config/role_labels`**: Personalización de los nombres de los 4 estatus/roles (`label_0`, `label_1`, `label_2`, `label_9`).

---

## 🛠️ 3. Componentes Principales

- `src/App.jsx`: Componente raíz con header, badge de rol, botón de Admin, botón de Nueva Reserva, banner de comunicados oficiales y renderizado de PWA.
- `src/components/CalendarView.jsx`: Vista del calendario (Modo Mes y Modo Semana), filtro por salas, indicador de ocupación dinámica de salas en el mes, botón compacto `Sincronizar` y navegación inmutable.
- `src/components/BookingModal.jsx`: Modal de creación de reserva con selectores de Hora Inicio/Fin, autopoblado de fecha seleccionada y detector en tiempo real de solapamientos (alerta en rojo).
- `src/components/CleaningCard.jsx`: Tarjeta del cuadrante de limpieza con botones compactos "Turno completado" (verde sobrio), "Cambiar Turno" y "Reportar Incidencia".
- `src/components/AdminPanel.jsx`: Panel de administración con 5 pestañas: Usuarios (con renombrado dinámico de estatus), Cuadrante Limpieza, Incidencias, Anuncios (con duración por días y borrado directo) y Salas.
- `src/components/SyncModal.jsx`: Popover modal de sincronización que exporta reservas filtradas por vista activa y sala, incluyendo enlace nativo Data-URI blanco `"Añadir a mi iPhone"` y nota sobre cuentas corporativas.
- `src/components/RoomPickerModal.jsx`: Modal táctil tipo Action Sheet para seleccionar salas en móviles sin usar desplegables `<select>` nativos.
- `src/components/AttendeesModal.jsx`: Modal de consulta de lista de socios apuntados a una reserva.
- `src/components/AnnouncementBanner.jsx`: Banner destacado en la portada de la web para comunicados urgentes u oficiales.

---

## 🚀 4. Comandos de Despliegue y Git

- **Compilar producción**:  
  `npm run build`
- **Desplegar en Firebase Hosting & Firestore Rules**:  
  `cmd.exe /c npx firebase-tools deploy --only hosting,firestore:rules --project war-calendario`
- **Commit y Push a GitHub**:  
  `cmd.exe /c "git add . && git commit -m 'mensaje' && git push origin main"`

---

## 📌 5. Próximos Pasos Recomendados para la Siguiente Sesión

1. **Configuración opcional de Vercel para URL Feed `webcal://`**:
   - Crear un pequeño servidor de API serverless en Vercel (`https://war-calendario.vercel.app/api/ical`) sin coste alguno ni necesidad de registrar tarjeta de crédito, evitando riesgos de cobro por DDoS de Firebase Cloud Functions (Plan Blaze).
2. **Notificaciones Automáticas por Email / Telegram**:
   - Recordatorios automáticos para el socio de limpieza al iniciar su semana o al recibir una solicitud de cambio de turno.
3. **Módulo de Inventario / Material de la Asociación**:
   - Registro para consultar y reservar escenografía de wargames, juegos de mesa, cámaras o focos.
