# Prompt — HOJA MAESTRA (todos los estados en UNA imagen)

## Por qué una sola imagen
Un único render = la MISMA capibara en TODOS los estados (mismo color, tamaño,
detalles). Es la consistencia máxima. Solo cambian pose/patas.

## Reglas de oro
1. UNA sola imagen. Organizada en **filas**: cada fila = un estado, frames de izquierda a derecha.
2. La MISMA capibara en TODA la hoja: mismo color, mismo tamaño, mismas proporciones, mismo grosor de contorno. SOLO cambian pose/patas/accesorios.
3. Estilo pixel-art 16-bit, contorno oscuro limpio, sin anti-aliasing.
4. De perfil mirando a la DERECHA (salvo dormir = acostada, cafecito = sentada).
5. Misma línea de piso en cada fila; mismo tamaño de frame en TODA la hoja.
6. **Fondo verde sólido #00B140.** Sin sombras.
7. **SEPARACIÓN amplia** entre frames y entre filas (espacio verde entre cada uno).
8. **SIN texto, SIN números, SIN etiquetas, SIN bordes ni líneas de rejilla.**

## PROMPT (cópialo tal cual)
> A single large pixel-art sprite sheet of ONE cute chibi capybara, organized in rows, one animation per row, frames left to right. The SAME capybara in EVERY frame across the whole sheet: identical warm brown color, identical size, proportions and outline thickness — only the pose/legs/accessories change. 16-bit pixel art, crisp pixels, no anti-aliasing, thick clean dark outline. Side profile facing RIGHT. Generous green spacing between every frame and every row. Flat solid #00B140 green background, no shadows, NO text, NO numbers, NO labels, NO grid lines, NO borders.
>
> Rows, in this order:
> Row 1 — WALK cycle, 4 frames (legs in 4 progressive walking positions).
> Row 2 — RUN cycle, 4 frames (forward lean, fast gallop legs).
> Row 3 — SLEEP, 2 frames, lying down curled, eyes closed as happy curves, a small "Z" floating (frame 2 belly slightly raised, breathing).
> Row 4 — CELEBRATE, 2 frames, both front paws raised happily with little sparkles.
> Row 5 — COFFEE, 2 frames, sitting and holding a tiny coffee cup (frame 2 sipping).
> Row 6 — SCARED, 2 frames, startled with wide eyes and a small sweat drop, ears flat.
> Row 7 — JUMP, 2 frames, frame 1 crouched gathering energy, frame 2 mid-air with legs tucked and ears up.
>
> Keep every capybara the same scale across all rows. Feet aligned per row.

## Consejos
- Usa tu `base.png` como imagen de referencia para fijar el aspecto.
- Si mete texto/números: re-genera con `absolutely no text, no numbers, no labels anywhere`.
- Mantén MUCHO espacio verde entre sprites: facilita que yo los recorte sin que se peguen.

## Qué hago cuando me la pases
1. Quito el fondo verde a transparencia.
2. Detecto cada capibara como un "blob" separado, los agrupo por filas (estados) en el orden de arriba.
3. Los re-alineo a spritesheets exactos por estado (walk/run/sleep/celebrate/coffee/scared).
4. Conecto cada estado a un comportamiento en la extensión.
