// ============================================================================
// APP.TS — Orquestador YOSO
// ============================================================================
import * as ort                        from 'onnxruntime-web'
import { MotorInferencia, BORRAR }     from './inference'
import { GameManager }                 from './game'
import { RenderizadorUI }              from './ui'
import type { ResultadoManos, Punto }  from './types'

// Declaraciones MediaPipe — sin empaquetador oficial para Vite, se carga por CDN
declare const Hands:            new (opts: object) => ManosMediaPipe
declare const Camera:           new (el: HTMLVideoElement, opts: object) => { start: () => void }
declare const drawConnectors:   (ctx: CanvasRenderingContext2D, pts: Punto[], conns: unknown, estilo: object) => void
declare const drawLandmarks:    (ctx: CanvasRenderingContext2D, pts: Punto[], estilo: object) => void
declare const HAND_CONNECTIONS: unknown

interface ManosMediaPipe {
  setOptions: (opts: object) => void
  onResults:  (cb: (r: ResultadoManos) => void) => void
  send:       (opts: { image: HTMLVideoElement }) => Promise<void>
}

// ── Límites de la región de interés (coordenadas normalizadas) ────────────────
const LIMITE_SUPERIOR = 0.15
const LIMITE_IZQUIERDO = 0.20
const LIMITE_DERECHO   = 0.80

export class YOSOApp {
  private readonly motor: MotorInferencia
  private readonly juego: GameManager
  private readonly ui:    RenderizadorUI

  private readonly video:  HTMLVideoElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx:    CanvasRenderingContext2D

  private modo: 'traductor' | 'entrenamiento' | 'aprendizaje' = 'traductor'
  private anchoCanvas  = 0
  private altoCanvas   = 0
  private prevMunecaX  = 0
  private prevMunecaY  = 0

  constructor() {
    this.motor  = new MotorInferencia()
    this.juego  = new GameManager()
    this.ui     = new RenderizadorUI()

    this.video  = document.querySelector('.input_video')!
    this.canvas = document.querySelector('.output_canvas')!
    this.ctx    = this.canvas.getContext('2d')!

    this._vincularEventos()
  }

  // ── Arranque ─────────────────────────────────────────────────────────────────
  public async iniciar(): Promise<void> {
    // Los binarios WASM vienen del CDN con versión anclada al paquete npm instalado
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
      this.ui.mensajeSplash('✗ Error al cargar el modelo', true)
      console.error('[YOSO] Arranque fallido:', err)
      return
    }

    const manos = new Hands({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    })
    manos.setOptions({
      maxNumHands:            1,
      modelComplexity:        0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence:  0.5
    })

    let skeletonOculto = false
    manos.onResults((r) => {
      if (!skeletonOculto) { skeletonOculto = true; this.ui.ocultarSkeleton() }
      this._alRecibirResultados(r)
    })

    new Camera(this.video, {
      onFrame: async () => { await manos.send({ image: this.video }) },
      width: 1280, height: 720
    }).start()
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
          this.motor.reiniciar()
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

  // ── Pipeline MediaPipe ────────────────────────────────────────────────────────
  private _alRecibirResultados(resultado: ResultadoManos): void {
    if (resultado.image) {
      const vid = resultado.image as HTMLVideoElement
      const ancho = vid.videoWidth  || (vid as unknown as HTMLCanvasElement).width
      const alto  = vid.videoHeight || (vid as unknown as HTMLCanvasElement).height
      if (ancho !== this.anchoCanvas || alto !== this.altoCanvas) {
        this.canvas.width  = ancho
        this.canvas.height = alto
        this.anchoCanvas   = ancho
        this.altoCanvas    = alto
      }
    }

    const ac = this.canvas.width, al = this.canvas.height
    this.ctx.save()
    this.ctx.clearRect(0, 0, ac, al)
    this.ctx.translate(ac, 0)
    this.ctx.scale(-1, 1)
    this.ctx.drawImage(resultado.image as CanvasImageSource, 0, 0, ac, al)

    if (resultado.multiHandLandmarks?.length > 0) {
      const puntos      = resultado.multiHandLandmarks[0]
      const lateralidad = resultado.multiHandedness[0]

      drawConnectors(this.ctx, puntos, HAND_CONNECTIONS,
        { color: 'rgba(56,189,248,0.80)', lineWidth: 2 })
      drawLandmarks(this.ctx, puntos,
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
