# Reglas del Proyecto: Agent Creator

- **Concisión extrema en los Prompts:** A partir de ahora, cada vez que redactes, definas o crees el `System Prompt` de un subagente, debes hacerlo lo más corto y directo posible. Evita saludos, introducciones largas o palabrería. Ve directo al grano: Rol, Tareas y Reglas. El objetivo es ahorrar la máxima cantidad de tokens de contexto (context window) cuando esos agentes se ejecuten en el futuro.

- **Backup obligatorio en Handovers / Checkpoints:** Cada vez que se solicite o cree un Handover o la finalización de un bloque de entregables, realizarás un backup completo del estado del código y de la documentación (por ejemplo, creando una copia/tar o realizando un git commit / checkpoint de respaldo) para preservar la integridad del proyecto y permitir restauración ante cualquier contingencia.
