# MediaPipe Tasks Vision Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar de `@mediapipe/hands` (CDN legacy) a `@mediapipe/tasks-vision` (paquete npm, ya instalado), eliminando 3 scripts de CDN del HTML, reemplazando la Camera API + callback async por `HandLandmarker.detectForVideo()` síncrono con loop `requestAnimationFrame`, y activando `delegate: 'GPU'` para mejor rendimiento en PC y móvil.

**Architecture:** El orquestador (`src/core/app.ts`) inicializa `HandLandmarker` con `FilesetResolver` (WASM desde jsdelivr CDN), arranca el stream de cámara directamente vía `getUserMedia` + `video.srcObject`, y corre un loop `rAF` que guarda frames duplicados comparando `video.currentTime`. El motor de inferencia (`src/engine/inference.ts`) no cambia — recibe los mismos `Punto[]` y `Lateralidad`. `DrawingUtils` del mismo paquete reemplaza las funciones globales CDN `drawConnectors`/`drawLandmarks`.

**Tech Stack:** TypeScript strict + `@mediapipe/tasks-vision@0.10.35` (npm) + `requestAnimationFrame` + `onnxruntime-web@1.25.1` (sin cambios)

---

## Mapa de archivos

| Archivo | Cambio |
|---|---|
| `src/engine/types.ts` | Eliminar `ResultadoManos` (ya no se usa) |
| `index.html` | Eliminar 3 `<script>` CDN MediaPipe; agregar preconnect a `storage.googleapis.com` |
| `src/core/app.ts` | Reescribir sección de cámara: imports, declares, `_iniciarCamara`, `_alRecibirResultados` |
| `vite.config.ts` | Agregar `@mediapipe/tasks-vision` a `optimizeDeps.exclude` |
| `public/sw.js` | Agregar cache para `storage.googleapis.com`; bump versión a `yoso-v6` |
| `package.json` | Guardar `@mediapipe/tasks-vision` en dependencies (ya está en node_modules) |

**Sin cambios:** `src/engine/inference.ts`, `src/game/game.ts`, `src/ui/*`, `src/lib/*`, `ml/*`

---

## Task 1: Registrar @mediapipe/tasks-vision en package.json

El paquete ya está en `node_modules` pero no en `package.json` (fue instalado sin `--save`).

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Agregar la dependencia**

```bash
pnpm add @mediapipe/tasks-vision@0.10.35
```

- [ ] **Step 2: Verificar que quedó registrado**

```bash
node -e "const p = require('./package.json'); console.log(p.dependencies)"
```

Salida esperada:
```
{ 'onnxruntime-web': '1.25.1', '@mediapipe/tasks-vision': '0.10.35' }
```

---

## Task 2: Eliminar ResultadoManos de types.ts

`ResultadoManos` modelaba la respuesta de la vieja API `@mediapipe/hands`. La nueva API retorna `HandLandmarkerResult` (tipo importado del paquete npm). Se elimina para evitar confusión.

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1: Verificar que ResultadoManos solo se usa en app.ts**

```bash
npx rg "ResultadoManos" src/
```

Salida esperada: solo `src/engine/types.ts` y `src/core/app.ts`.

- [ ] **Step 2: Eliminar la interfaz de types.ts**

Reemplazar el contenido completo de `src/engine/types.ts` con:

```typescript
export interface Punto {
  x: number
  y: number
  z: number
}

export interface Lateralidad {
  label: 'Left' | 'Right'
  score: number
}

export interface ItemTop {
  letra: string
  prob:  number
}

export interface CargaDebug {
  probRed:        number
  confEfectiva:   number
  distancia:      number | null
  distRef:        number | null
  bufferActual:   string[]
  topN:           ItemTop[]
  bufferProgreso: number
}

export interface Centroide {
  coords:   Float32Array
  dist_ref: number
}

export type MapaCentroides = Record<string, Centroide>

export interface CallbacksInferencia {
  alConfirmarLetra:    (letra: string) => void
  alDetectarLetra:     (letra: string, confianza: number, latInferencia: number, latProcesamiento: number, esCamaraIzquierda: boolean) => void
  alActualizarDebug:   (carga: CargaDebug) => void
}

export interface OpcionesInicioInferencia {
  sesion:     unknown
  centroides: MapaCentroides | null
  callbacks:  CallbacksInferencia
}
```

- [ ] **Step 3: Type-check para confirmar que inference.ts sigue compilando**

```bash
npx tsc --noEmit
```

Salida esperada: errores SOLO en `src/core/app.ts` (porque todavía importa `ResultadoManos`). Si hay errores en otros archivos, investigar antes de continuar.

---

## Task 3: Actualizar index.html

Eliminar los 3 scripts CDN legacy de MediaPipe y agregar `preconnect` a `storage.googleapis.com` (desde donde se descarga el modelo `hand_landmarker.task`).

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Eliminar los 3 scripts CDN y agregar preconnect**

Localizar y eliminar estas líneas en `index.html`:
```html
  <script defer src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" crossorigin="anonymous"></script>
```

Agregar después del preconnect a `fonts.gstatic.com` (antes del `<link rel="stylesheet">`):
```html
  <link rel="preconnect" href="https://storage.googleapis.com" crossorigin="anonymous">
```

- [ ] **Step 2: Verificar que no quedan referencias a los scripts eliminados**

```bash
npx rg "mediapipe/hands|mediapipe/camera_utils|mediapipe/drawing_utils" index.html
```

Salida esperada: sin resultados.

---

## Task 4: Reescribir src/core/app.ts

Este es el cambio central. Se reemplazan: todas las `declare const` globales, la interfaz `ManosMediaPipe`, el `Hands` + `Camera` + callbacks async, y las llamadas a `drawConnectors`/`drawLandmarks` globales.

**Files:**
- Modify: `src/core/app.ts`

- [ ] **Step 1: Reescribir el archivo completo**

Reemplazar el contenido de `src/core/app.ts` con:

```typescript
// ============================================================================
// APP.TS — Orquestador YOSO
// ============================================================================
import * as ort                                        from 'onnxruntime-web'
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult }                   from '@mediapipe/tasks-vision'
import { MotorInferencia, BORRAR }                     from '../engine/inference'
import { GameManager }                                 from '../game/game'
import { RenderizadorUI }                              from '../ui'
import type { Lateralidad, Punto }                     from '../engine/types'

// ── Límites de la región de interés (coordenadas normalizadas) ────────────────
const LIMITE_SUPERIOR  = 0.10
const LIMITE_IZQUIERDO = 0.15
const LIMITE_DERECHO   = 0.85

// ── Umbral de luminosidad media (0-255) bajo el cual se alerta oscuridad ──────
const UMBRAL_LUZ = 40

export class YOSOApp {
  private readonly motor: MotorInferencia
  private readonly juego: GameManager
  private readonly ui:    RenderizadorUI

  private readonly video:  HTMLVideoElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx:    CanvasRenderingContext2D
  private _drawingUtils:   DrawingUtils | null = null

  private modo: 'traductor' | 'entrenamiento' | 'aprendizaje' = 'traductor'
  private anchoCanvas  = 0
  private altoCanvas   = 0
  private prevMunecaX  = 0
  private prevMunecaY  = 0

  // ── Visibilidad / pausa térmica ───────────────────────────────────────────
  private _pausado = false

  // ── Muestreo de luminosidad ───────────────────────────────────────────────
  private readonly _canvasLuz: HTMLCanvasElement
  private readonly _ctxLuz:    CanvasRenderingContext2D
  private _frameCount    = 0
  private _toastLuzVivo  = false

  // ── Circular buffer para FPS — sin push/shift por frame ──────────────────
  private readonly _fpsBuf = new Float64Array(60)
  private _fpsHead = 0
  private _fpsFill = 0

  constructor() {
    this.motor  = new MotorInferencia()
    this.juego  = new GameManager()
    this.ui     = new RenderizadorUI()

    this.video  = document.querySelector('.input_video')!
    this.canvas = document.querySelector('.output_canvas')!
    this.ctx    = this.canvas.getContext('2d')!

    // Canvas pequeño reutilizable para muestreo de luminosidad (32×18 = 576 píxeles)
    this._canvasLuz      = document.createElement('canvas')
    this._canvasLuz.width  = 32
    this._canvasLuz.height = 18
    this._ctxLuz = this._canvasLuz.getContext('2d', { willReadFrequently: true })!

    document.addEventListener('visibilitychange', () => this._alCambiarVisibilidad())
    this._vincularEventos()
  }

  // ── Arranque ─────────────────────────────────────────────────────────────────
  public async iniciar(): Promise<void> {
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.25.1/dist/'

    try {
      this.ui.mensajeSplash('Cargando modelo…')

      const [sesion, centroidesRaw] = await Promise.all([
        ort.InferenceSession.create('./YOSO.onnx', {
          executionProviders:     ['webgl', 'wasm'],
          graphOptimizationLevel: 'all',
          enableCpuMemArena:      true,
          intraOpNumThreads:      2
        }),
        fetch('./Centroides.json')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ])

      const centroides = centroidesRaw
        ? Object.fromEntries(
            Object.entries(centroidesRaw as Record<string, { coords: number[]; dist_ref: number }>)
              .map(([k, v]) => [k, { coords: new Float32Array(v.coords), dist_ref: v.dist_ref }])
          )
        : null

      this.motor.iniciar({
        sesion,
        centroides,
        callbacks: {
          alConfirmarLetra:  (l)                              => this._alConfirmarLetra(l),
          alDetectarLetra:   (l, c, lat, _latP, esIzquierda) => this._alDetectarLetra(l, c, lat, esIzquierda),
          alActualizarDebug: (p)                              => this.ui.actualizarDebug(p)
        }
      })

      this.ui.ocultarSplash()

    } catch (err) {
      this.ui.mensajeSplash('Error al cargar el modelo', true)
      console.error('[YOSO] Arranque fallido:', err)
      return
    }

    await this.ui.mostrarOnboarding()
    await this._iniciarCamara()
  }

  // ── Inicialización de cámara ──────────────────────────────────────────────────
  private async _iniciarCamara(): Promise<void> {
    const esMobil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const constraints: MediaStreamConstraints = esMobil
      ? { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } }, audio: false }
      : { video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: false }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      const domErr = err as DOMException
      if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
        this.ui.mostrarEstadoVacio(domErr, () => void this._iniciarCamara(), true)
      } else {
        this.ui.mostrarEstadoVacio(domErr, () => void this._iniciarCamara(), false)
      }
      return
    }

    this.ui.ocultarEstadoVacio()

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
    )
    const handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.80,
      minHandPresenceConfidence: 0.70,
      minTrackingConfidence: 0.70
    })

    this._drawingUtils = new DrawingUtils(this.ctx)

    this.video.srcObject = stream
    await new Promise<void>(resolve => { this.video.onloadedmetadata = () => resolve() })
    await this.video.play()

    let skeletonOculto  = false
    let ultimoVideoTime = -1

    const loop = () => {
      requestAnimationFrame(loop)
      if (this._pausado || this.video.readyState < 2) return
      if (this.video.currentTime === ultimoVideoTime) return  // frame ya procesado
      ultimoVideoTime = this.video.currentTime

      const ahora = performance.now()

      // FPS: circular buffer preasignado — sin push/shift
      const oldest = this._fpsFill >= 2
        ? this._fpsBuf[this._fpsFill < 60 ? 0 : this._fpsHead]
        : 0
      this._fpsBuf[this._fpsHead] = ahora
      this._fpsHead = (this._fpsHead + 1) % 60
      if (this._fpsFill < 60) this._fpsFill++
      const fps = this._fpsFill >= 2
        ? (this._fpsFill - 1) / ((ahora - oldest) / 1000)
        : 0

      const t0       = performance.now()
      const resultado = handLandmarker.detectForVideo(this.video, ahora)
      const mpMs     = performance.now() - t0

      if (!skeletonOculto) { skeletonOculto = true; this.ui.ocultarSkeleton() }
      this._alRecibirResultados(resultado)
      this.ui.actualizarPerfFrame(mpMs, fps)
    }
    requestAnimationFrame(loop)
  }

  // ── Page Visibility API — pausa térmica ───────────────────────────────────────
  private _alCambiarVisibilidad(): void {
    this._pausado = document.hidden
    if (document.hidden) {
      this.motor.reiniciar(true)
      this.ui.estadoListo('idle')
      this.ui.limpiarMano()
    }
  }

  // ── Diagnóstico de luminosidad ────────────────────────────────────────────────
  private _verificarLuminosidad(): void {
    if (this.video.videoWidth === 0) return
    try {
      this._ctxLuz.drawImage(this.video, 0, 0, 32, 18)
      const data = this._ctxLuz.getImageData(0, 0, 32, 18).data
      let suma = 0
      for (let i = 0; i < data.length; i += 4) {
        suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      const promedio = suma / (data.length / 4)
      const oscuro   = promedio < UMBRAL_LUZ
      if (oscuro !== this._toastLuzVivo) {
        this._toastLuzVivo = oscuro
        oscuro
          ? this.ui.mostrarToast('luz', 'Poca luz detectada — busca una fuente de luz frente a ti para mejorar la precisión.', 'warn', 0)
          : this.ui.ocultarToast('luz')
      }
    } catch {
      // SecurityError posible en contextos cross-origin
    }
  }

  // ── Eventos ───────────────────────────────────────────────────────────────────
  private _vincularEventos(): void {
    document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const pestaña = btn.dataset['tab'] as typeof this.modo
        document.querySelectorAll('.mode-tab').forEach(b => {
          b.classList.remove('active')
          b.setAttribute('aria-selected', 'false')
        })
        btn.classList.add('active')
        btn.setAttribute('aria-selected', 'true')
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
        document.getElementById(`tab-${pestaña}`)?.classList.add('active')

        if (pestaña !== this.modo) {
          this.modo = pestaña
          this.ui.limpiarTexto()
          this.ui.limpiarSena()
          this.motor.reiniciar(true)
          pestaña === 'entrenamiento' ? void this.juego.activar() : this.juego.desactivar()
        }
      })
    })
  }

  // ── Callbacks del motor de inferencia ────────────────────────────────────────
  private _alDetectarLetra(letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    this.ui.actualizarPrediccion(letra, confianza, latencia, esIzquierda)
    if (this.modo === 'aprendizaje') {
      letra !== '-' ? this.ui.resaltarSena(letra) : this.ui.limpiarSena()
    }
  }

  private _alConfirmarLetra(letra: string): void {
    if (this.modo === 'entrenamiento') { this.juego.onLetraConfirmada(letra); return }
    if (this.modo === 'aprendizaje')   return
    this.ui.agregarLetra(letra, letra === BORRAR)
  }

  // ── Pipeline HandLandmarker ───────────────────────────────────────────────────
  private _alRecibirResultados(resultado: HandLandmarkerResult): void {
    const ancho = this.video.videoWidth
    const alto  = this.video.videoHeight
    if (ancho !== this.anchoCanvas || alto !== this.altoCanvas) {
      this.canvas.width  = ancho
      this.canvas.height = alto
      this.anchoCanvas   = ancho
      this.altoCanvas    = alto
    }

    // Verificar luminosidad cada ~3 segundos (90 frames a 30 fps)
    if (++this._frameCount % 90 === 0) this._verificarLuminosidad()

    const ac = this.canvas.width, al = this.canvas.height
    this.ctx.save()
    this.ctx.clearRect(0, 0, ac, al)
    this.ctx.translate(ac, 0)
    this.ctx.scale(-1, 1)
    this.ctx.drawImage(this.video, 0, 0, ac, al)

    if (resultado.landmarks.length > 0) {
      const puntos: Punto[]  = resultado.landmarks[0] as Punto[]
      const lateralidad: Lateralidad = {
        label: resultado.handedness[0][0].categoryName as 'Left' | 'Right',
        score: resultado.handedness[0][0].score
      }

      this._drawingUtils!.drawConnectors(puntos, HandLandmarker.HAND_CONNECTIONS,
        { color: 'rgba(56,189,248,0.80)', lineWidth: 2 })
      this._drawingUtils!.drawLandmarks(puntos,
        { color: '#38BDF8', lineWidth: 0.5, radius: 3 })

      this.ctx.setTransform(1, 0, 0, 1, 0, 0)

      let minX = 1, minY = 1, maxX = 0
      for (const pt of puntos) {
        if (pt.x < minX) minX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.x > maxX) maxX = pt.x
      }
      const fueraZona = minY < LIMITE_SUPERIOR || minX < LIMITE_IZQUIERDO || maxX > LIMITE_DERECHO

      this.ui.actualizarROI(fueraZona)

      if (fueraZona) {
        this.ui.estadoListo('warning')
        this.ui.limpiarMano()
        this.motor.reiniciar()
        this.ctx.restore()
        return
      }

      this.ui.estadoListo('signing')

      const muneca = puntos[0]
      const jitter = Math.abs(muneca.x - this.prevMunecaX) + Math.abs(muneca.y - this.prevMunecaY)
      this.prevMunecaX = muneca.x
      this.prevMunecaY = muneca.y

      this.ui.estadoMano(jitter > 0.03 ? 'Inestable' : 'Óptimo', jitter <= 0.03)

      void this.motor.procesar(puntos, lateralidad, jitter)

    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ui.estadoListo('idle')
      this.ui.limpiarROI()
      this.ui.limpiarMano()
      this.motor.reiniciar()
    }

    this.ctx.restore()
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Salida esperada: 0 errores. Si hay errores de tipos en la nueva API (e.g. `HandLandmarker.HAND_CONNECTIONS` o `DrawingUtils`), verificar versión del paquete con `cat node_modules/@mediapipe/tasks-vision/package.json | grep '"version"'`.

---

## Task 5: Actualizar vite.config.ts

Excluir `@mediapipe/tasks-vision` de la pre-optimización de Vite, igual que se hace con `onnxruntime-web`, para evitar que Vite intente procesar sus imports internos de WASM.

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Agregar tasks-vision a optimizeDeps.exclude**

Localizar la sección `optimizeDeps` en `vite.config.ts`:
```typescript
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
```

Reemplazarla con:
```typescript
  optimizeDeps: {
    exclude: ['onnxruntime-web', '@mediapipe/tasks-vision']
  },
```

- [ ] **Step 2: Verificar build en dev**

```bash
pnpm dev
```

Abrir `http://localhost:5173` y verificar que no hay errores de Vite en consola. Detener con Ctrl+C.

---

## Task 6: Actualizar Service Worker

Agregar `storage.googleapis.com` a la estrategia cache-first (donde vive el modelo `hand_landmarker.task`). Bump de versión para limpiar la caché antigua con los scripts de `@mediapipe/hands`.

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Bump versión y agregar handler para googleapis**

Modificar `public/sw.js`:

**Cambio 1** — Bump de versión (línea 4):
```javascript
const CACHE = 'yoso-v6'
```

**Cambio 2** — Agregar bloque de caché para `storage.googleapis.com` después del bloque de Google Fonts y antes del bloque CDN jsDelivr:

Localizar el bloque que termina con `return` del handler de `esFonts`, e insertar después de él:

```javascript
  // ── Google Storage (modelo hand_landmarker.task): cache-first ───────
  const esGoogleStorage = url.hostname === 'storage.googleapis.com'

  if (esGoogleStorage) {
    e.respondWith(
      safeMatch(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok || res.type === 'opaque') guardarEnCache(e.request, res)
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }
```

- [ ] **Step 2: Verificar que la versión cambió y el bloque está bien ubicado**

```bash
npx rg "yoso-v6|storage.googleapis" public/sw.js
```

Salida esperada: ambas cadenas encontradas.

---

## Task 7: Verificación final

- [ ] **Step 1: Type-check completo**

```bash
npx tsc --noEmit
```

Salida esperada: **0 errores**.

- [ ] **Step 2: Build de producción**

```bash
pnpm run build
```

Salida esperada: sin errores, bundle generado en `dist/`. Verificar que no hay warnings sobre WASM en el output.

- [ ] **Step 3: Iniciar dev y verificar en browser**

```bash
pnpm dev
```

Abrir `http://localhost:5173` y verificar:
1. **Skeleton aparece**: esqueleto azul sobre la mano detectada
2. **HUD muestra latencia**: el campo `MP frame` en el debug panel muestra < 50ms en PC
3. **Reconocimiento funciona**: las letras del alfabeto se detectan correctamente
4. **Handedness correcto**: con mano derecha del usuario, la inferencia no está invertida (probar A, B, C — si el modelo invierte las letras, la lateralidad está al revés → ajustar la lógica en `_alRecibirResultados` cambiando `'Left'` por `'Right'`)
5. **Sin errores en consola**: no debe haber `TypeError`, `CORS error`, ni errores de módulos

> **NOTA IMPORTANTE — Handedness:** La API `tasks-vision` puede reportar la lateralidad invertida respecto a la vieja API. Si el reconocimiento falla consistentemente pero el skeleton aparece bien, invertir la condición en `app.ts`:
> ```typescript
> // Si las letras salen al revés, cambiar:
> label: resultado.handedness[0][0].categoryName as 'Left' | 'Right',
> // por:
> label: (resultado.handedness[0][0].categoryName === 'Left' ? 'Right' : 'Left') as 'Left' | 'Right',
> ```

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts index.html src/core/app.ts vite.config.ts public/sw.js package.json pnpm-lock.yaml
git commit -m "feat: migrar MediaPipe a tasks-vision@0.10.35 (GPU delegate, rAF loop, sin CDN legacy)"
```
