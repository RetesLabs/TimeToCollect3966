---
description: "Arma un mensaje de commit y commitea el trabajo actual, sin agregarte como co-autor."
disable-model-invocation: true
---

Commitea los cambios actuales.

1. `git status` y `git diff` (staged + unstaged) para ver todo lo que cambió. `git diff --stat HEAD` para el resumen.
2. Armá un mensaje de commit describiendo el cambio (asunto conciso en modo imperativo, cuerpo con bullets si hace falta), en base a lo que efectivamente cambió — no repitas texto del workplan sin verificarlo contra el diff real.
3. Chequeo de branch: `git rev-parse --abbrev-ref HEAD`. Si es `main`, avisá antes de seguir.
4. Mostrale al usuario el mensaje propuesto y qué archivos se van a stagear antes de commitear (no uses `git add -A`; stagea archivos puntuales).
5. Commiteá con `git commit` usando ese mensaje.
   - **No agregues línea de `Co-Authored-By`** — es una excepción explícita a la convención general de commits para este repo.
6. Reportá el hash del commit y el resumen. No hagas `git push` salvo que el usuario lo pida explícitamente.
