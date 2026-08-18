---
description: "Ejecuta el workplan.md de una feature: lanza executor-plan por tarea (respetando oleadas) y supervisor en paralelo."
disable-model-invocation: true
argument-hint: "<carpeta-del-feature>"
---

## 1. Resolver la carpeta del feature

Igual que en las otras skills del flujo: `$ARGUMENTS`, o inferí por el branch actual, o preguntale al usuario.

Confirmá que existe `.features/<carpeta>/workplan.md`. Si no existe, avisá que hay que correr `/design-workplan` primero.

## 2. Lanzar supervisor en paralelo (background)

Antes de empezar a ejecutar tareas, lanzá un agente `supervisor` **en background** con este prompt:

> "Leé `.claude/agent-instructions.md`. Mantené actualizado `.features/<carpeta>/feature-details.html` mientras se ejecuta `.features/<carpeta>/workplan.md`, siguiendo tus instrucciones."

No esperes su resultado — sigue corriendo solo hasta que el workplan termine.

## 3. Ejecutar el workplan por oleadas

Leé `workplan.md` y agrupá las tareas por oleada.

Para cada oleada, **en orden**:

- Lanzá un agente `executor-plan` **foreground** por cada tarea de la oleada, todos en el mismo mensaje (para que corran en paralelo). Prompt por tarea:

  > "Leé `.claude/agent-instructions.md`. Ejecutá la tarea `<id-tarea>` de `.features/<carpeta>/workplan.md`, siguiendo tus instrucciones."

- Esperá a que termine toda la oleada antes de arrancar la siguiente (es una barrera: la oleada siguiente puede depender de los cambios de esta).
- Si alguna tarea de la oleada terminó `failed`, evaluá si las oleadas siguientes dependen de ella. Si es bloqueante, parate y reportale al usuario antes de seguir.

## 4. Cuando todas las tareas terminaron

Confirmá en `workplan.md` que no queda ninguna tarea en `pending`/`in_progress`.

Lanzá un agente `test-user-guide-creator` (foreground) con este prompt:

> "Leé `.claude/agent-instructions.md`. Generá `.features/<carpeta>/test-user-feature-guide.html`, siguiendo tus instrucciones."

## 5. Reportar

Resumen final: tareas completadas vs falladas, y que `feature-details.html` y `test-user-feature-guide.html` quedaron generados. Sugerí: "Revisá los cambios y cuando estés conforme corré `/commit`."

Recordatorio: ningún agente de este flujo hizo commit ni push — eso queda para `/commit`, manual.
