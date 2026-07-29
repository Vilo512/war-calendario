# Documento de Handover - W.A.R. (Wargames and Rol Lleida)

**Fecha de actualización**: 26 de Julio de 2026  
**Estado del Proyecto**: ✅ **Bloques 1, 2, 3 y 4 Completados, 100% Funcionales, Compilados y Desplegados en Producción**  
**Despliegue Firebase Hosting (Frontend)**: [https://war-calendario.web.app/](https://war-calendario.web.app/)  
**Despliegue Vercel Serverless (API iCal Feed en vivo)**: [https://war-calendario.vercel.app/api/ical](https://war-calendario.vercel.app/api/ical)  
**Repositorio GitHub**: [https://github.com/Vilo512/war-calendario.git](https://github.com/Vilo512/war-calendario.git) (Rama `main` al día)  

---

## 📐 1. Resumen de Arquitectura y Tecnologías

- **Frontend**: React (Vite) + Vanilla CSS + PWA (Progressive Web App con Service Worker y Manifest).
- **Backend / Base de Datos**: Firebase Authentication + Firestore (Colecciones en tiempo real).
- **Servidor de Sincronización WebCal / iCal en Vivo**: Vercel Serverless Function (`api/ical.js`).
- **Servidor de Bajas Permanentes**: Vercel Serverless Function (`api/delete-user.js`).
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
3. **`bookings`**: `{ name, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), room, activityType ('open'|'closed'), targetAudience ('publico'|'semisocios'|'socios'), attendees: [{uid, name, isManual}], maxAttendees }`
4. **`cleaning_schedule/config`**: `{ members: [{id, name, type, uid}], currentWeekIndex }`
5. **`cleaning_history`**: `{ weekId, weekRange, memberId, memberName, isManual, completedAt, completedByUid, completedByName }`
6. **`cleaning_swaps`**: Solicitudes de cambio de turno de limpieza entre socios.
7. **`cleaning_incidents`**: Reportes de faltas o problemas en el turno de limpieza.
8. **`announcements`**: Comunicados oficiales (`title`, `content`, `priority`, `durationDays`, `expiresAt`, `createdAt`).
9. **`config/role_labels`**: Personalización de los nombres de los 4 estatus/roles.

---

## 🛠️ 3. Resumen de Bloques Completados

- **🎨 Bloque 1: Identidad de Marca y Estética Visual General**:
  - Header reestructurado como **W.A.R. (Wargames and Rol Lleida)** con logo circular realzado.
  - Acabado glassmorphism translúcido y marca de agua táctil.
- **📱 Bloque 2: Optimización de Interfaz Mobile (iPhone SE - 375x667px)**:
  - Tarjeta de limpieza compacta con badge `"Último día"`, botones apilables y sustitución del icono por SVG de escoba nativo.
- **🧹 Bloque 3: Módulo de Histórico de Limpieza**:
  - Registro automático e inmutable en `cleaning_history`.
  - Modal de consulta cronológico con buscador en tiempo real y badges de socios de app vs socios manuales.
- **🎲 Bloque 4: Reservas Avanzadas & Control de Actividades**:
  - Reservas por salas y cálculo visual del grid.
  - Modales para crear reservas con modalidades "Abierta" vs "Cerrada" y segmentación de Público Objetivo (Todos, Semisocios, Socios).
  - Inclusión de lista de "Pre-apuntados" (socios existentes mediante `uid` e invitados manuales mediante entrada de texto).
  - Botón "Duplicar reserva" para clonar reservas en otras fechas.
- **💬 Bloque 5: Integración de Bot de WhatsApp (Avisos de Comunidad)**:
  - Implementado webhook serverless en Vercel (`api/whatsapp.js`).
  - Conexión con Green API (Plan Developer) para envíos gratuitos a Grupos.
  - Switch incorporado en el modal de reservas `[x] Anunciar en WhatsApp`.
  - Lógica de control de duplicados mediante flag de Firebase `whatsapp_sent: true`.

---

## 🚧 Estado Actual (Lo que falta por hacer)

- **Bloque 6: Módulo de Analytics e Inteligencia de Limpieza (NEXT STEP)**.

---

## 🔒 4. Reglas de Backup y Checkpoints

- **Regla del Proyecto**: Cada vez que se solicite un Handover o finalice una sesión de trabajo, se realiza un git commit y push a la rama `main` de GitHub como punto de restauración inmutable.
- **Commit de Cierre**: `c0a035d` ("Checkpoint: Ajuste de maquetacion responsive vertical e integracion de picker nativo para Modalidad y Publico Objetivo").
