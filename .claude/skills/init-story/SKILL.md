---
description: "Arranca el trabajo sobre una feature nueva: trae lo último del repo, crea el branch, y llama a story-refiner."
disable-model-invocation: true
argument-hint: "<carpeta-del-feature>"
---

Arranca una feature nueva a partir de un `feature.md` guardado en `.features/<carpeta>/`.

## 1. Resolver la carpeta del feature

Si `$ARGUMENTS` viene con un nombre de carpeta, usalo. Si no:
- Si hay un `feature.md` abierto en el editor, usá su carpeta contenedora.
- Si no hay forma de inferirlo, listá las carpetas de `.features/` (`Glob ".features/*/feature.md"`) y preguntale al usuario cuál es.

Confirmá que existe `.features/<carpeta>/feature.md`. Si no existe, avisá y parate ahí.

## 2. Traer lo último del repo

```bash
git fetch origin
git status
```

Si hay cambios locales sin commitear que no son de este flujo, avisá antes de seguir (no los toques).

## 3. Crear el branch

Derivá el nombre de branch a partir del nombre de carpeta: minúsculas, sin tildes, espacios y caracteres raros reemplazados por `-`. Ej: `Skills y Agentes` → `skills-y-agentes`.

- Chequeá si ya existe: `git branch --list <branch>` y `git ls-remote --heads origin <branch>`.
- Si existe local → `git checkout <branch>`.
- Si existe solo en remoto → fetch + checkout.
- Si no existe → `git checkout main && git pull origin main && git checkout -b <branch>`.

Reportá qué acción se tomó.

## 4. Llamar a story-refiner

Delegá a un agente `story-refiner` (foreground) con este prompt:

> "Leé `.claude/agent-instructions.md`. Refiná `.features/<carpeta>/feature.md` en un `context.md` en la misma carpeta, siguiendo tus instrucciones."

## 5. Siguiente paso

Mostrale al usuario un resumen de `context.md` (y las preguntas abiertas si quedaron). Sugerí: "Cuando el context.md te cierre, corré `/design-workplan`."
