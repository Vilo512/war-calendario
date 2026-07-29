# Documento de Handover - W.A.R.lendario (Wargames and Rol Lleida)

**Fecha de actualización**: 29 de Julio de 2026  
**Estado del Proyecto**: 🚀 **v1.0.0 - MVP Finalizado con Éxito y Desplegado en Producción**  
**URL de Producción Principal (Vercel)**: [https://warlendario.vercel.app/](https://warlendario.vercel.app/)  
**URL de Producción Secundario (Firebase)**: [https://war-calendario.web.app/](https://war-calendario.web.app/)  
**Repositorio GitHub**: [https://github.com/Vilo512/war-calendario.git](https://github.com/Vilo512/war-calendario.git) (Rama `main` al día)  
**Puntos de Respaldo / Hard Checkpoint**:
- Tag Git: `v1.0.0-mvp-complete`
- Rama Backup: `backup-mvp-complete`

---

## 📐 1. Resumen de Arquitectura y Tecnologías

- **Frontend**: React (Vite) + Vanilla CSS + PWA (Progressive Web App con Service Worker y Manifest).
- **Backend / Base de Datos**: Firebase Authentication + Firestore (Colecciones en tiempo real).
- **Enrutamiento Nivel SPA**: SPA nativo ultrarrápido con soporte en Vercel (`vercel.json`) y Firebase (`firebase.json`).
- **Integraciones externas**: 
  - Green API para bot de notificaciones a WhatsApp (Grupo de Avisos de la Comunidad).
  - Feed iCal / Webcal en vivo para suscripción de calendarios nativos (iOS / Google Calendar) con URL dinámica según el dominio actual.
- **Estética & Diseño**: 
  - Identidad de Marca: **W.A.R.lendario** (*Wargames and Rol Lleida*).
  - Táctica / Esténcil militar en blanco y negro (Saira Stencil One + Outfit font).
  - Logo circular realzado en el header.
  - Marca de agua SVG en background con opacidad ~9% y paneles translúcidos glassmorphism.
  - Responsivo optimizado para móviles (iPhone SE 375x667 y superiores) con `clamp()` para ajuste automático de fuentes.

---

## 🗄️ 2. Estructura de Colecciones en Firestore

1. **`users`**: `{ uid, email, displayName, role (0: No socio, 1: Semisocio, 2: Socio, 9: Admin) }`
2. **`rooms`**: `{ name, capacity, active }`
3. **`bookings`**: `{ name, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), time, room, activityType ('open'|'closed'), targetAudience ('publico'|'semisocios'|'socios'), attendees: [{uid, name, isManual}], maxAttendees, whatsapp_sent: boolean }`
4. **`cleaning_schedule/config`**: `{ members: [{id, name, type, uid}], currentWeekIndex }`
5. **`cleaning_history`**: `{ weekId, weekRange, memberId, memberName, isManual, completedAt, completedByUid, completedByName }`
6. **`cleaning_swaps`**: Solicitudes de cambio de turno de limpieza entre socios.
7. **`cleaning_incidents`**: Reportes de faltas o problemas en el turno de limpieza.
8. **`announcements`**: Comunicados oficiales (`title`, `content`, `priority`, `durationDays`, `expiresAt`, `createdAt`).
9. **`config/role_labels`**: Personalización de los nombres de los 4 estatus/roles.

---

## 🛠️ 3. Resumen de Bloques Completados

- **🎨 Bloque 1: Identidad de Marca y Estética Visual General**:
  - Marca actualizada a **W.A.R.lendario (Wargames and Rol Lleida)** en header, HTML y PWA.
  - Acabado glassmorphism translúcido y marca de agua táctil.
- **📱 Bloque 2: Optimización de Interfaz Mobile (iPhone SE - 375x667px)**:
  - Header adaptativo con `clamp()` CSS para evitar recortes de texto.
  - Tarjeta de limpieza compacta con badge `"Último día"`, botones apilables y sustitución del icono por SVG de escoba nativo.
- **🧹 Bloque 3: Módulo de Histórico de Limpieza**:
  - Registro automático e inmutable en `cleaning_history`.
  - Modal de consulta cronológico con buscador en tiempo real y badges de socios de app vs socios manuales.
- **🎲 Bloque 4: Reservas Avanzadas & Control de Actividades**:
  - Reservas por salas y cálculo visual del grid.
  - Modales para crear reservas con modalidades "Abierta" vs "Cerrada" y segmentación de Público Objetivo (Todos, Semisocios, Socios).
  - Inclusión de lista de "Pre-apuntados" (socios existentes mediante `uid` e invitados manuales mediante entrada de texto).
  - Botón "Duplicar reserva" para clonar reservas en otras fechas.
- **💬 Bloque 5: Bot de WhatsApp de Avisos de Comunidad**:
  - Servicio dual client-side y serverless function para Green API.
  - Plantilla enriquecida con fecha `DD/MM/YYYY`, modalidad (Abierta/Cerrada), público objetivo, conteo de plazas y nombres de pre-apuntados.
  - Envíos automáticos a WhatsApp al crear reservas, publicar anuncios oficiales o cancelar reservas.
  - Control de estado mediante flag `whatsapp_sent: true`.
- **📊 Bloque 6: Panel de Analíticas e Inteligencia de Limpieza**:
  - Ruta privada `/analytics` protegida para Administradores con estadísticas mensuales de partidas, horas reservadas, ocupación por salas y afluencia por días de la semana con gráficos nativos en HTML/CSS.
  - Asistente de Limpieza Inteligente en la `CleaningCard` que consulta las reservas de la semana en curso y sugiere al socio asignado los días con 0 reservas o menor volumen de horas para limpiar el local de manera óptima.

---

## 🔒 4. Respaldo y Restauración

- **Tag Git**: `v1.0.0-mvp-complete`
- **Rama Backup**: `backup-mvp-complete`
- **Comando de Restauración**: `git checkout v1.0.0-mvp-complete`
