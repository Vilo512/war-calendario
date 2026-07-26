# PRD: WebApp Asociación de Juegos (W.A.R. - Wargames and Rol Lleida)

## 1. Visión General
Aplicación web orientada a móviles (mobile-first) para gestionar la asociación de juegos **W.A.R. (Wargames and Rol Lleida)**: reservas de estudios/salas, roles de miembros con permisos diferenciados, cuadrante de limpieza con histórico e inteligencia, anuncios, exportación de calendarios en vivo (iCal/WebCal), bot de avisos de WhatsApp y analíticas de uso.

---

## 2. Roles y Permisos de Usuarios
- **No socio / Simpatizante sin cuota**:
  - Consulta del calendario general de actividades públicas.
  - Participación en actividades abiertas permitidas.
  - **NO** puede crear reservas ni acceder al cuadrante/histórico de limpieza.
- **Semisocio / Simpatizante con cuota**:
  - Consulta del calendario y reservas.
  - **NO** puede crear reservas / montar actividades de sala.
  - **NO** entra en el cuadrante rotativo de limpieza.
- **Socio**:
  - Creación de reservas / montaje de actividades.
  - Formar parte del cuadrante rotativo de limpieza.
  - Solicitar / aceptar cambios de semana de limpieza con otros socios.
  - Marcar su turno de limpieza como completado.
- **Admin**:
  - Gestión total de usuarios y roles (No socio, Semisocio, Socio, Admin) con nombres de rol personalizables.
  - Gestión de salas/estudios (crear, editar, renombrar, eliminar, ajustar capacidad).
  - Control del cuadrante de limpieza: saltos de turno, socios manuales (sin app), resolución de incidencias y confirmación manual de limpiezas.
  - Gestión de anuncios destacados y de reservas (cancelar/duplicar/modificar cualquier reserva).

---

## 3. Arquitectura por Bloques de Desarrollo

### 🎨 Bloque 1: Identidad de Marca y Estética Visual General
- **3.7. Nomenclatura del Header y Pestaña**:
  - Título principal: Cambiar "WAR Calendario" por "**W.A.R.**" tanto en el header de la web como en `<title>` (`index.html`).
  - Subtítulo: Cambiar a únicamente "**Wargames and Rol Lleida**".
- **3.8. Protagonismo del Logo**:
  - Incrementar el tamaño y realce visual del logo circular de la asociación en el header.
- **1. Transparencia de Tarjetas**:
  - Estender el acabado translúcido (estilo glassmorphism/alpha) utilizado en la tarjeta de anuncios al resto de tarjetas del sistema (`CleaningCard`, tarjetas del calendario, etc.) para vislumbrar la marca de agua del logo de fondo.
- **2. Ajuste de Opacidad de Marca de Agua**:
  - Ajustar la opacidad del logo SVG de fondo (del 4% actual a ~7-10%) para aumentar su presencia visual manteniendo un contraste óptimo con el texto.

---

### 📱 Bloque 2: Optimización de Interfaz Mobile (iPhone SE - 375x667px)
- **3.1. Ajuste en Tarjeta de Limpieza ("Último día")**:
  - Evitar truncado o salto de línea en "Último día" y la insignia roja de alerta mediante tipografía fluida o badge compacto con `white-space: nowrap`.
- **3.2. Botones de Acción de Limpieza**:
  - En pantallas estrechas (<400px), apilar los botones ("Cambiar turno" y "Reportar incidencia") en columna vertical o ajustar padding/fuente para evitar desbordamientos.
- **3.3. Legibilidad de "Tu turno" en Turnos Futuros**:
  - Corregir contraste del distintivo "Tu turno" (actualmente texto blanco sobre fondo blanco). Cambiar a texto oscuro (`#1a1a1a`) sobre fondo claro o contenedor con alto contraste.
- **3.4. Iconografía de Limpieza**:
  - Reemplazar el ícono de moneda (`$`) en la tarjeta de limpieza por un SVG nativo/LUCIDE de **escoba o burbujas de limpieza**.
- **3.5. Botones de Acción del Header**:
  - Ajustar "Admin panel" y "Nueva reserva" (que se parte en 2 líneas por el `+`) para que quepan en 1 sola línea en 375px reduciendo padding/fuente.
- **3.6. Espaciado de Cabecera**:
  - Aumentar el espaciado vertical (`margin-top`/`gap`) entre la barra de usuario ("Hola, Usuario - Badge - Cerrar sesión") y el subtítulo del header.

---

### 🧹 Bloque 3: Módulo de Histórico de Limpieza
- **Registro Cronológico**:
  - Colección Firestore `cleaning_history`: Almacena cada evento de limpieza completado (`id`, `memberId`, `memberName`, `isManual`, `completedAt`, `completedByAdminUid`, `weekIndex`).
- **Limpiezas de Socios Manuales**:
  - Cuando un Admin marca "completado" el turno de un socio manual, el sistema registra la fecha y hora exacta del clic como momento de finalización de dicha limpieza.
- **Vista de Histórico**:
  - Pantalla/Modal de consulta para ver el registro cronológico histórico de quién limpió qué día, con filtros por fecha y socio.

---

### 🎲 Bloque 4: Reservas Avanzadas & Control de Actividades
- **6. Actividades Cerradas & Pre-apuntados**:
  - Tipos de actividad: **Abiertas** (cualquiera puede unirse hasta el cupo) vs **Cerradas/Privadas** (cupo cerrado o restringido).
  - Permitir al creador/admin pre-apuntar socios (de la app) y usuarios manuales (sin app) al crear la reserva (ej. mesa de rol de 6 personas con 5 pre-apuntados y 1 plaza libre).
- **6.1. Segmentación por Público Objetivo (`targetAudience`)**:
  - Opciones de acceso/asistencia:
    1. Solo socios.
    2. Socios y simpatizantes (semisocios).
    3. Socios, simpatizantes y no socios (público general).
- **6.2. Duplicación / Recurrencia de Actividades**:
  - Botón de "Duplicar reserva" para clonar fácilmente partidas recurrentes o campañas en otra fecha, hora o sala.

---

### 💬 Bloque 5: Integración de Bot de WhatsApp para Anuncios
- **Publicación Automática en Comunidad/Canal de WhatsApp**:
  - Opción toggle al crear una reserva: `[x] Anunciar en el canal de WhatsApp de la Asociación`.
- **Control de Estado y Prevención de Re-envíos**:
  - Almacenamiento en Firestore del flag `whatsapp_sent: boolean` dentro del documento de la reserva para asegurar que cada anuncio se envíe una sola vez.
- **Opciones de Integración**:
  - Análisis de proveedores: Meta WhatsApp Business Cloud API (oficial pero restrictivo en plantillas promocionales), Evolution API (self-hosted no oficial, mayor flexibilidad), o Twilio / Baileys.
- **Diseño de Serverless Function (`api/whatsapp.js` en Vercel)**:
  - Endpoint seguro mediante Webhook que es invocado tras confirmar la reserva en Firestore. Valida el origen de la petición y procesa el envío asíncrono hacia la API de mensajería elegida.
- **Estructura de Plantilla del Mensaje Automático**:
  - Formato: *📢 [Título de la partida]* \n📅 *[Fecha y Hora]* \n📍 *[Sala/Estudio]* \n👥 *[Plazas disponibles]* \n🔗 *[Enlace directo a la web app para apuntarse]*

---

### 📊 Bloque 6: Módulo de Analytics e Inteligencia de Limpieza
- **Analíticas de Uso y Ocupación (Esquema de Firestore)**:
  - Colección `analytics_daily_stats` para guardar contadores agregados por día/sala. Métricas visuales de días de la semana con mayor afluencia, horas punta de uso y salas más demandadas.
- **Inteligencia Cruzada con Histórico de Limpieza**:
  - Análisis de patrones de limpieza consultando la colección `cleaning_history`.
  - **Algoritmo de Sugerencias Inteligentes**: Cruzado de datos entre la fecha/hora de finalización del último socio en limpiar y las reservas del turno actual. Si un socio limpió el domingo por la noche (y no hubo reservas el lunes por la mañana), el sistema advertirá al socio de la semana actual para que no limpie el lunes, recomendando postergar su turno y optimizar la limpieza.
