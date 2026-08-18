---
description: "Genera el workplan.md de una feature a partir de su context.md."
disable-model-invocation: true
argument-hint: "<carpeta-del-feature>"
---

## 1. Resolver la carpeta del feature

Igual que en `/init-story`: usá `$ARGUMENTS` si viene, si no inferí por el branch actual (`git rev-parse --abbrev-ref HEAD` → buscar la carpeta de `.features/` cuyo slug matchee) o preguntale al usuario.

Confirmá que existe `.features/<carpeta>/context.md`. Si no existe, avisá que hay que correr `/init-story` primero.

## 2. Llamar a workplan-designer

Delegá a un agente `workplan-designer` (foreground) con este prompt:

> "Leé `.claude/agent-instructions.md`. Generá `workplan.md` a partir de `.features/<carpeta>/context.md`, siguiendo tus instrucciones."

## 3. Siguiente paso

Mostrale al usuario el resumen de tareas y oleadas. Sugerí: "Cuando estés conforme con el workplan, corré `/execute-plan`."
