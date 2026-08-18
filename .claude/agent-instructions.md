# Instrucciones para Agentes

Todos los agentes de este flujo (story-refiner, workplan-designer, executor-plan, supervisor, test-user-guide-creator) deben leer este archivo antes de empezar a trabajar.

Leé también `CLAUDE.md` para el contexto del proyecto (SQS Explorer).

## Reglas para todos los agentes

- **Hablar en español.** Todo el output dirigido al usuario (resúmenes, reportes, y el contenido de los `.md`/`.html` que generás) va en español.
- **Ningún agente hace commit ni push.** Ni siquiera `git add`. Commitear es responsabilidad exclusiva de la skill `/commit`, que corre en el hilo principal, no en un subagente.
- **Git de solo lectura.** Si necesitás inspeccionar el repo, usá únicamente `git status`, `git diff`, `git log`, `git show`, `git branch --list`. Nada de `checkout`, `reset`, `restore`, `clean`, `merge`, `rebase`, `stash`, `add`, `commit`, `push`.
- **Quedate en la carpeta del feature.** Los archivos de output (`context.md`, `workplan.md`, `feature-details.html`, `test-user-feature-guide.html`) se leen y escriben dentro de `.features/<carpeta-del-feature>/`. No los muevas ni los renombres, y no toques el `feature.md` original.
- **Alcance.** No hagas trabajo fuera de lo que te pide tu tarea puntual. Si encontrás algo que amerita atención pero no es tu responsabilidad, repórtalo en vez de resolverlo vos.

## Agentes de solo lectura sobre código

`story-refiner`, `workplan-designer`, `supervisor` y `test-user-guide-creator` no editan código fuente del proyecto (`src/`, etc.) — solo lo leen para entender contexto, y escriben sus archivos de output dentro de `.features/<carpeta>/`.

## Agente ejecutor

`executor-plan` es el único agente de este flujo autorizado a editar código fuente, siguiendo las convenciones de `CLAUDE.md` y del código existente.
