# PRD: WebApp Asociación de Juegos (Actualizado con Recuperación & Socios Manuales)

## 1. Visión General
Aplicación web orientada a móviles (mobile-first) para gestionar la asociación de juegos WAR: reservas de estudios/salas, roles de miembros con permisos diferenciados, turnos rotativos de limpieza y exportación a calendarios.

## 2. Roles y Permisos de Usuarios
- **No socio**:
  - Puede consultar el calendario general / participar en actividades.
  - **NO** puede crear reservas.
  - **NO** puede ver la tarjeta ni el calendario de limpieza.
- **Semisocio**:
  - Puede consultar el calendario y reservas.
  - **NO** puede crear reservas / montar actividades.
  - **NO** entra en el cuadrante de limpieza ni lo visualiza.
- **Socio**:
  - Puede crear reservas / montar actividades.
  - Formar parte del cuadrante rotativo de limpieza y ver el horario de limpieza.
  - Solicitar / aceptar cambios de semana de limpieza con otros socios.
- **Admin**:
  - Control total sobre usuarios (cambiar rol bidireccionalmente entre No socio, Semisocio, Socio y Admin).
  - Gestionar estudios/salas de la asociación (crear, editar, renombrar, eliminar).
  - Reorganizar / forzar saltos de turno en el cuadrante de limpieza y añadir socios no registrados a la lista.
  - Eliminar cualquier reserva del calendario.

## 3. Lógica del Turno de Limpieza & Socios Manuales
- **Ciclo Semanal**: De lunes a domingo. Cada lunes cambia automáticamente al siguiente de la lista.
- **Socios no registrados**: El Admin puede añadir nombres manualmente a la lista rotativa (para socios que no usen la aplicación web) de forma que el turno se muestre correctamente para todos.
- **Cambio de Semana entre Socios**: Un socio registrado puede intercambiar su semana con otro socio.
- **Gestión de Incidencias (Admin)**: Si alguien no limpia, el Admin recibe la alerta y puede reasignar o pasar el turno manualmente.

## 4. Autenticación & Recuperación de Contraseña
- Formulario de Login/Registro con opción de **"¿Olvidaste tu contraseña?"** (vía `sendPasswordResetEmail` de Firebase).
- Envío de email de restablecimiento directo al usuario.

## 5. Gestión de Salas / Estudios (Admin)
- Colección `rooms` en Firestore.
- El Admin puede añadir nuevas salas o modificar las existentes.
- El modal de reserva (`BookingModal`) cargará dinámicamente las salas activas de Firestore.
