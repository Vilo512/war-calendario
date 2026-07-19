# PRD: WebApp Asociación de Juegos

Este documento (Product Requirements Document) consolida todos los requisitos y servirá como el **Plan de Ejecución Maestro** para el Orquestador (el agente principal) una vez que se inicie el desarrollo en el proyecto final.

## 1. Visión General
Crear una aplicación web orientada a móviles (mobile-first) para gestionar una asociación de juegos de mesa, rol y wargames. La aplicación permitirá reservar salas, evitar conflictos de uso, gestionar un sistema rotativo de limpieza y suscribirse a los calendarios.

## 2. Pila Tecnológica (Tech Stack)
- **Frontend:** React + Vite (o Vanilla JS), CSS puro (Modern Web Guidance).
- **Backend / BaaS:** Firebase (Firestore, Auth, Cloud Functions).

## 3. Equipo Asignado (Agentes)
- **Orquestador (Tú):** Supervisor del proyecto y coordinador.
- **`DB_Architect`:** Especialista en Firebase, modelado de datos y lógica de backend (Cloud Functions).
- **`UI_Engineer`:** Especialista en diseño visual, experiencia de usuario y componentes responsivos.
- **`QA_Tester`:** Especialista en romper la app buscando bugs de concurrencia, UI y seguridad.

> [!IMPORTANT]
> **Regla Global:** Todos los agentes deben regirse por la máxima concisión (ahorro de contexto) y deben entregar al final de sus tareas un resumen "para dummies" de lo que han hecho.

## 4. Fases de Ejecución (Orden de Tareas)

### Fase 1: Inicialización (Orquestador)
1. Iniciar proyecto frontend (ej. `npm create vite@latest`).
2. Configurar Firebase e inicializar el SDK.

### Fase 2: Cimientos de Datos (`DB_Architect`)
1. Diseñar colecciones en Firestore (`users`, `rooms`, `reservations`, `cleaning_schedule`).
2. Escribir y desplegar `firestore.rules` (evitar que usuarios borren reservas de otros).
3. Diseñar lógica del algoritmo rotativo de turnos de limpieza.

### Fase 3: Interfaz Visual (`UI_Engineer`)
1. Construir vista central `CalendarView` (clara, visual e interactiva).
2. Construir `BookingModal` (flujo rápido para elegir sala/juego).
3. Construir `CleaningCard` (notificación visual destacada para el usuario al que le toca limpiar).
> [!TIP]
> Usar `chrome-devtools-plugin` frecuentemente en esta fase para auditar la visualización real.

### Fase 4: Lógica Avanzada e Integración
1. **`DB_Architect`**: Desarrollar endpoint (Cloud Function) para exportar un feed `.ics` dinámico.
2. **`UI_Engineer`**: Crear el botón `CalendarSync` conectándolo a dicho endpoint.
3. **Orquestador**: Asegurar que los componentes de UI leen y escriben correctamente en Firestore.

### Fase 5: Pruebas de Estrés (`QA_Tester`)
1. Lanzar tests de concurrencia (simular colisiones en reservas).
2. Testear permisos (intentar hackear turnos de limpieza o modificar reservas ajenas).
3. Auditar la vista móvil buscando botones inaccesibles o rotos.

## 5. Criterios de Aceptación Finales
- Un socio puede reservar una sala libre desde su móvil en menos de 3 clics.
- Es imposible que dos personas reserven la misma sala a la misma hora.
- El socio puede suscribirse al calendario en su móvil mediante un link dinámico.
- Nadie puede marcar como "limpiado" el turno de otro para eludir sus responsabilidades.
