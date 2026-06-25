# CLAUDE.md — Capibara Pet

Contexto del proyecto para asistentes de IA (Claude Code). Léelo antes de trabajar.

## Qué es

Extensión de VS Code: una capibara mascota animada que vive en un **panel webview**
acoplado. Reacciona a lo que hace el usuario en el editor (escribir, guardar, errores,
pausas). Animada con **spritesheets + CSS `steps()`** (sin parpadeo) y sin interferir
con el código.

- Nombre / id: `capibara-pet` · displayName: "Capibara Pet"
- Versión actual: `0.2.0`
- Autor: Juan Carlos Condori
- Licencia: MIT

## Meta (objetivo final)

**Publicar la extensión en el Visual Studio Code Marketplace.** El código y el
empaquetado ya están listos; falta la parte de cuenta/credenciales del usuario.

Pasos pendientes para publicar:

1. Crear el publisher en https://marketplace.visualstudio.com/manage
2. Reemplazar `"publisher": "your-publisher-id"` en `package.json` por el ID real.
3. Generar un PAT en Azure DevOps (scope: Marketplace → Manage).
4. `npx @vscode/vsce login <publisher-id>` (pegar el PAT).
5. `npx @vscode/vsce publish`

Nota: Microsoft retira los PAT globales el 1-dic-2026; para CI conviene migrar a
Microsoft Entra ID. Para publicación manual el PAT sigue sirviendo.

## Arquitectura

- `src/extension.ts` — TODO el código. Un `WebviewViewProvider` (`CapibaraViewProvider`)
  registra la vista `capibaraPet.view`. Genera el HTML/CSS/JS del webview inline.
  La máquina de estados de animación corre en el JS del webview; el lado de la
  extensión solo escucha eventos del editor y manda mensajes (`postMessage`).
- `out/extension.js` — salida compilada (TypeScript → CommonJS). Es lo que carga VS Code.
- `media/*_sheet.png` — spritesheets por estado (celdas de 128px, fondo transparente,
  alineados a la base). El JS los anima moviendo `background-position` con `steps(n)`.
- `media/icon.png` — ícono del Marketplace (256×256).
- `media/pet-icon.svg` — ícono del contenedor de vista en la barra de actividad.

## Estados y disparadores

| Estado     | Sheet                | Frames | Se activa cuando…                         |
|------------|----------------------|:------:|-------------------------------------------|
| walk       | `walk_sheet.png`     | 4      | por defecto (pasea, se mueve en X)        |
| run        | `run_sheet.png`      | 7      | al escribir (`onDidChangeTextDocument`)   |
| jump       | `jump_sheet.png`     | 2      | al cambiar de línea (selección)           |
| celebrate  | `celebrate_sheet.png`| 4      | al guardar (`onDidSaveTextDocument`)      |
| scared     | `scared_sheet.png`   | 2      | hay errores (`onDidChangeDiagnostics`)    |
| coffee     | `coffee_sheet.png`   | 2      | pausa media (~6 s sin actividad)          |
| sleep      | `sleep_sheet.png`    | 2      | pausa larga (~15 s); el sprite trae 💤    |

Prioridad de estados (en el JS `state()`): celebrate > scared > jump > run > sleep >
coffee > walk. La config de frames/velocidad está en el objeto `SHEETS` en
`src/extension.ts`. Solo `walk` y `run` se desplazan (objeto `MOVE`).

## Comandos

```bash
npm run compile                       # compilar TS -> out/
npm run watch                         # compilar en modo watch
npx @vscode/vsce package --allow-missing-repository   # genera el .vsix
```

Para probar sin publicar: en VS Code → "Extensions: Install from VSIX…" y elegir
`capibara-pet-0.2.0.vsix`. O abrir el proyecto y pulsar **F5** (Extension Host).

## Cómo se generan los sprites (importante)

Los sprites se crean con un generador de imágenes (Nano Banana / Gemini) y se
procesan con Python + Pillow. La fuente es una **hoja maestra** `master.png` (todos
los estados en una sola imagen, fondo verde `#00B140`) — está en la carpeta del
usuario `Downloads/tiras/`, NO en el repo.

Pipeline de procesamiento (cuando llega un nuevo `master.png`):
1. Chroma-key: quitar el verde a transparencia (`greenness = g - max(r,b)`).
2. Segmentar por bandas: filas por proyección horizontal, frames por proyección vertical.
3. Frames pegados: dividir cada celda en N partes (N = round(ancho/172)) y **ajustar
   cada corte al valle** del perfil de columnas (para no cortar cuerpos).
4. Normalizar: escala global única, centrar y alinear a la base en celdas de 128px.
5. Exportar `media/<estado>_sheet.png`.

Layout actual de `master.png` (1408×768): fila0=walk(4), fila1=run(7, pegados 2-3-2),
fila2=sleep(2)+celebrate(4), fila3=coffee(2)+scared(2)+jump(2).

Si se agregan/cambian estados: actualizar el pipeline, regenerar los sheets y
actualizar el objeto `SHEETS` (frame count) en `src/extension.ts`.

## Convenciones / notas

- Engine mínimo: `vscode ^1.74.0`.
- Sin dependencias de runtime; solo devDeps (typescript, @types).
- CSP del webview con `nonce`; recursos solo desde `media/` (`localResourceRoots`).
- Limitación conocida: VS Code NO permite overlays flotantes fijos sobre el editor;
  por eso la mascota vive en un panel webview (se puede arrastrar a la barra lateral
  derecha para dejarla en una esquina). No reintentar el enfoque de "decoración".
- `.vscodeignore` empaqueta solo lo necesario (sheets + icon + out). No incluye `src/`
  ni los `sprite-*.md`.

## Pendientes / ideas futuras

- [ ] Publicar al Marketplace (ver Meta).
- [ ] (Opcional) Inicializar git + agregar `"repository"` en package.json para que el
      README y sus enlaces se vean completos en la página del Marketplace.
- [ ] (Opcional) Comando para mostrar/ocultar o ajustar tamaño/velocidad desde settings.
