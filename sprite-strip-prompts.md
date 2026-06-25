# Prompts para una TIRA única de frames (spritesheet)

## Por qué una sola tira
- Un solo render = la capibara sale **idéntica** en todos los frames (mismo color/detalles); solo cambian las patas.
- Permite animar con CSS `steps()` (mover background-position) → fluido y **sin parpadeo**.

## Reglas de oro
1. **Una sola imagen horizontal** con TODOS los frames en una fila.
2. **Exactamente 4 frames**, celdas del mismo tamaño, separación uniforme.
3. **La MISMA capibara en cada frame**: mismo color, tamaño, grosor de contorno; SOLO cambian las patas.
4. **Mirando a la DERECHA**, de perfil. Misma línea de piso (patas alineadas).
5. **Fondo verde sólido `#00B140`**, sin sombras.
6. **SIN texto, SIN números, SIN etiquetas, SIN bordes ni líneas de rejilla.**
7. Relación de aspecto **ancha 4:1** (p. ej. 2048×512), capibara centrada en cada cuarto.

---

## PROMPT — tira de CAMINATA (la principal)
> Single horizontal pixel-art sprite sheet (film strip) of ONE cute chibi capybara, 4 frames in a single row, evenly spaced equal cells, 4:1 aspect ratio. The SAME capybara in every frame: identical warm brown color, same size, same proportions, same outline thickness — ONLY the legs change to show a walk cycle. Side profile facing RIGHT, feet aligned on the same baseline. 16-bit pixel-art, crisp pixels, no anti-aliasing, thick clean dark outline. Frame 1: front leg forward / back leg back (contact). Frame 2: legs together under body (passing). Frame 3: legs swapped (opposite contact). Frame 4: legs gathered (passing). Flat solid #00B140 green background, no shadow, no text, no numbers, no labels, no grid lines, no borders.

## PROMPT — tira de CARRERA (opcional, para cuando escribes)
> Same single-row 4-frame pixel-art sprite strip of the SAME capybara (identical color/size/outline), side profile facing RIGHT, 4:1 ratio, equal cells, flat #00B140 background. A fast RUN cycle with a forward lean: frame 1 legs stretched reaching forward, frame 2 gathered under body (suspension), frame 3 legs stretched backward pushing off, frame 4 mid-recovery. Same baseline in all frames. No text, no numbers, no labels, no grid lines.

## PROMPT — tira de DORMIR (opcional)
> Single-row 2-frame pixel-art sprite strip of the SAME capybara lying down asleep, side view, 2:1 ratio, equal cells, flat #00B140 background. Frame 1 belly relaxed, frame 2 belly slightly raised (breathing). Eyes closed as happy curved lines. No text, no numbers, no labels.

---

## Consejos para que salga alineada
- Usa la MISMA imagen de referencia (tu `base.png`) en cada prompt.
- Si añade texto/números pese a todo: re-genera pidiendo `absolutely no text, no numbers, no labels anywhere`.
- No importa si las celdas quedan un poco desiguales: yo recorto por contenido y re-alineo a una rejilla perfecta.
- Mantén el fondo verde plano y sin sombras para un recorte de transparencia limpio.

## Qué hago yo cuando me la pases
1. Recorto el fondo verde a transparencia.
2. Detecto cada frame por contenido, los re-alineo a una rejilla EXACTA (mismo tamaño y baseline).
3. Genero el spritesheet final `media/walk_sheet.png` (y run/sleep si las haces).
4. Cambio el webview a animación CSS `steps()` → fluida y sin parpadeo.
