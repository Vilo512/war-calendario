# Documento de Handover - WAR CALENDARIO (Asociación Los Cuervos)

**Fecha de actualización**: 26 de Julio de 2026  
**Estado del Proyecto**: ✅ **100% Funcional, Compilado y Desplegado en Producción**  
**Despliegue Firebase Hosting (Frontend)**: [https://war-calendario.web.app/](https://war-calendario.web.app/)  
**Despliegue Vercel Serverless (API iCal Feed en vivo)**: [https://war-calendario.vercel.app/api/ical](https://war-calendario.vercel.app/api/ical)  
**Repositorio GitHub**: [https://github.com/Vilo512/war-calendario.git](https://github.com/Vilo512/war-calendario.git) (Rama `main` al día)  

---

## 📐 1. Resumen de Arquitectura y Tecnologías

- **Frontend**: React (Vite) + Vanilla CSS + PWA (Progressive Web App con Service Worker y Manifest).
- **Backend / Base de Datos**: Firebase Authentication + Firestore (Colecciones en tiempo real).
- **Servidor de Sincronización WebCal / iCal en Vivo (100% Gratuito sin Firebase Blaze Plan)**:
  - **Vercel Serverless Function** (`api/ical.js`).
  - **Arquitectura Nativizada de 0 Dependencias**: Utiliza la librería nativa `crypto` de Node 18+ para firmar tokens JWT OAuth 2.0 y consultar la API REST oficial de Firestore.
  - **Cero errores de empaquetado** y latencia ultra baja (~15ms).
  - Soporta suscripción en **iPhone / iPad** (`webcal://`), **Google Calendar** (`https://`), y **Outlook** (`https://`).
  - **Filtro dinámico por Sala en URL**: `https://war-calendario.vercel.app/api/ical?room=Estudio%20A` (o `?room=ALL`).
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
- `src/components/AdminPanel.jsx`: Panel de administración con 5 pestañas:
  1. **Usuarios**: Renombrado dinámico de los 4 niveles de estatus y cambio de roles.
  2. **Cuadrante Limpieza**: Gestión de orden rotativo y permutas de semanas.
  3. **Incidencias**: Control y resolución de faltas de limpieza.
  4. **Anuncios**: Publicación con vigencia por días y borrado.
  5. **Salas**: Gestión de salas y **Herramienta de Purga/Borrado de Reservas por Mes o Vaciamiento Total**.
- `src/components/SyncModal.jsx`: Popover modal de sincronización con selector de salas, enlace nativo `webcal://` para iPhone y enlaces `https://` oficiales para Google Calendar y Outlook.
- `src/components/RoomPickerModal.jsx`: Modal táctil tipo Action Sheet para seleccionar salas en móviles sin usar desplegables `<select>` nativos.
- `src/components/AttendeesModal.jsx`: Modal de consulta de lista de socios apuntados a una reserva.
- `src/components/AnnouncementBanner.jsx`: Banner destacado en la portada de la web para comunicados urgentes u oficiales.
- `api/ical.js`: API Serverless en Vercel para generar feeds iCal RFC 5545 compatibles con iOS, Google y Microsoft 365.

---

## 🚀 4. Comandos de Despliegue y Git

- **Compilar producción**:  
  `npm run build`
- **Desplegar en Firebase Hosting & Firestore Rules**:  
  `npx firebase-tools deploy --only hosting,firestore:rules --project war-calendario`
- **Desplegar servidor iCal en Vercel**:  
  Basta con hacer `git push origin main` (Vercel está vinculado al repositorio GitHub `Vilo512/war-calendario`).

---

## 📌 5. Próximos Pasos y Nuevas Funcionalidades (Para la Siguiente Sesión)

1. **Implementar Feedback de Usuarios**:
   - Incorporar las nuevas solicitudes, sugerencias y mejoras recibidas por parte de los socios de la asociación.
2. **Notificaciones Automáticas por Email / Telegram**:
   - Recordatorios automáticos para el socio de limpieza al iniciar su semana o al recibir una solicitud de cambio de turno.
3. **Módulo de Inventario / Material de la Asociación**:
   - Registro para consultar y reservar escenografía de wargames, juegos de mesa, cámaras o focos.
