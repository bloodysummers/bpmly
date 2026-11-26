# Metrónomo · Presets y Track

Metrónomo online con **presets** (tempo + numerador + denominador) y un **track** tipo línea de
tiempo, con cambios de tempo y de compás a lo largo de una canción.

## Cómo usar

```bash
npm install
npm run dev        # http://localhost:3000
```

Los archivos de sonido ya están generados en `public/sounds/`. Para regenerarlos:

```bash
npm run sounds
```

## Funcionalidades

### Presets
- Definir **tempo** (slider, stepper, atajos 40–200, **tap tempo**), **numerador** y **denominador** del compás.
- **Patrón de acentos**: clic en cualquier recuadro de beat para marcarlo como acento. El primer beat
  suena con un sonido distinto (`accent.wav`) del resto (`normal.wav`).
- Guardar, listar, seleccionar, escuchar y eliminar presets. Se persisten en `localStorage`.

### Track
- **Arrastra presets** de la lista a la línea de tiempo para crear bloques; también se puede
  insertar un bloque **al vuelo** con el tempo/compás actual («＋ Bloque al vuelo»).
- **Repeticiones**: arrastra el borde derecho de un bloque (o edita «Repeticiones» en el inspector).
- **Tempo / compás por bloque**: editable en el inspector.
- **Reordenar** bloques arrastrándolos.
- **Duplicar** y **eliminar** bloques.
- Reproducir el track completo, o **desde un bloque** (botón o doble clic sobre el bloque): el playhead
  arranca en ese bloque, no al principio del track.
- **Loop** del track.
- Guardar, listar, seleccionar y eliminar tracks (`localStorage`).

En **modo preset**, cambiar tempo, numerador, denominador o acentos **mientras suena** surte efecto
en el siguiente beat, sin parar y volver a iniciar. En **modo track** esos controles quedan bloqueados
porque el tempo lo dicta cada bloque.

### Visualización
- **Visualizador de beats**: un recuadro por beat del compás; el acento en color ámbar, el resto en
  azul. Cada recuadro flashea cuando le toca sonar.
- **Metrónomo analógico**: aguja que oscila de lado a lado, sincronizada con el audio real; la pesa
  se acerca al pivote a mayor tempo (como en un metrónomo mecánico).
- **Línea de tiempo del track**: regla con compases, bloques, playhead que avanza en tiempo real,
  zoom, y bloque en curso resaltado. El auto-scroll **no pisa** el scroll del usuario: si desplazas
  y la cabeza de lectura sigue visible, se respeta tu posición; si el playhead se sale de la vista,
  se recupera al instante. Con el botón «Siguiendo / Seguimiento pausado» puedes desactivar el
  seguimiento por completo.

### Atajos
- `Espacio`: iniciar / detener.

## Arquitectura

| Archivo | Rol |
| --- | --- |
| `src/lib/engine.ts` | Motor de audio: `AudioContext`, scheduler con *lookahead*, cola de beats para sincronizar la UI, modos preset y track, loop, fin de track. |
| `src/lib/types.ts` | Modelos `Preset`, `Track`, `TrackBlock` y utilidades de tiempo. |
| `src/lib/storage.ts` | Persistencia en `localStorage` + datos de ejemplo. |
| `src/lib/metronome-context.tsx` | Estado global (presets, tracks, transporte) y bucle `requestAnimationFrame` que sincroniza los visualizadores con el audio. |
| `src/components/MetronomeControls.tsx` | Tempo, numerador, denominador, tap tempo, transporte, volumen. |
| `src/components/BeatVisualizer.tsx` | Recuadros de beat con flasheo y edición del patrón de acentos. |
| `src/components/Pendulum.tsx` | Metrónomo analógico en SVG. |
| `src/components/PresetPanel.tsx` | Lista de presets (selección, guardado, drag). |
| `src/components/Timeline.tsx` | Línea de tiempo: bloques, drag & drop, resize, playhead, zoom. |
| `src/components/TrackPanel.tsx` | Tracks guardados, transporte, inspector de bloque. |
| `scripts/generate-sounds.mjs` | Sintetiza los WAV (`accent`, `normal`, `soft`, `tick`). |

### Sincronización audio ↔ UI
El scheduler programa los beats con un *lookahead* de 120 ms sobre `AudioContext.currentTime` y los
deja en una cola. Cada frame, un `requestAnimationFrame` vacía la cola (`drain()`) y actualiza el
beat activo, la fase de la aguja y el playhead. Así la animación va exactamente a tiempo con el
sonido, sin acumular drift.

## Tests

```bash
npm run test:engine   # lógica del scheduler (mock de AudioContext): secuencia de beats, acentos, loop, inicio desde bloque
npm run test:e2e      # Playwright sobre Edge/Chromium: render, start/stop, flasheo de beats, aguja,
                      # tempo en caliente, drag & drop de presets, reordenar bloques, resize, playhead
                      # «desde el bloque», auto-scroll, guardado y persistencia
```

`test:e2e` usa el Edge del sistema (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`);
ajusta la constante `EDGE` si tu navegador está en otra ruta. Requiere el dev server corriendo en
`http://localhost:3001` (configurable con `URL`).
