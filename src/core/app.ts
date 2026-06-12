import * as ort                                          from 'onnxruntime-web'
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult }                     from '@mediapipe/tasks-vision'
import { MotorInferencia, BORRAR }                       from '../engine/inference'
import { GameManager }                                   from '../game/game'
import { RenderizadorUI }                                from '../ui'
import type { Lateralidad, Punto }                       from '../engine/types'

const LIMITE_SUPERIOR  = 0.10
const LIMITE_IZQUIERDO = 0.15
const LIMITE_DERECHO   = 0.85

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

  private _pausado = false
  private _iniciandoCamara = false

  private readonly _canvasLuz: HTMLCanvasElement
  private readonly _ctxLuz:    CanvasRenderingContext2D
  private _frameCount    = 0
  private _toastLuzVivo  = false

  // Circular buffer sin push/shift por frame
  private readonly _fpsBuf = new Float64Array(60)
  private _fpsHead = 0
  private _fpsFill = 0

  constructor() {
    this.motor  = new MotorInferencia()
    // UI primero: crea los IDs que GameManager consulta en su constructor.
    this.ui     = new RenderizadorUI()
    this.juego  = new GameManager()

    this.video  = document.querySelector('.input_video')!
    this.canvas = document.querySelector('.output_canvas')!
    this.ctx    = this.canvas.getContext('2d')!

    this._canvasLuz         = document.createElement('canvas')
    this._canvasLuz.width   = 32
    this._canvasLuz.height  = 18
    this._ctxLuz = this._canvasLuz.getContext('2d', { willReadFrequently: true })!

    document.addEventListener('visibilitychange', () => this._alCambiarVisibilidad())
    this._vincularEventos()
  }

  public async iniciar(): Promise<void> {
    ort.env.wasm.wasmPaths = '/ort/'

    try {
      this.ui.mensajeSplash('Cargando modelo…')

      // Solo WASM: el modelo es demasiado pequeño para que WebGPU amortice su overhead por frame.
      const hilos = Math.min(2, navigator.hardwareConcurrency ?? 2)
      const [sesion, centroidesRaw] = await Promise.all([
        ort.InferenceSession.create('./YOSO.onnx', {
          executionProviders:     ['wasm'],
          graphOptimizationLevel: 'all',
          enableCpuMemArena:      true,
          intraOpNumThreads:      hilos
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

  private async _iniciarCamara(): Promise<void> {
    if (this._iniciandoCamara) return
    this._iniciandoCamara = true
    try {
      // pointer:coarse + maxTouchPoints detecta táctiles incluyendo iPadOS 13+, que reporta UA "Macintosh"
      const esMobil = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0
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

      const vision = await FilesetResolver.forVisionTasks('/mediapipe')
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.80,
        minHandPresenceConfidence:  0.70,
        minTrackingConfidence:      0.70
      })

      this._drawingUtils = new DrawingUtils(this.ctx)

      this.video.srcObject = stream
      await new Promise<void>(resolve => { this.video.onloadedmetadata = () => resolve() })
      await this.video.play()

      let ultimoVideoTime = -1

      // rVFC = callback exacto por frame de video, sin depender del refresh rate del display.
      // Fallback a rAF en Safari iOS <17.
      const usaVFC = typeof (this.video as any).requestVideoFrameCallback === 'function'
      const programar = usaVFC
        ? () => (this.video as any).requestVideoFrameCallback(loop)
        : () => requestAnimationFrame(loop)

      const loop = () => {
        programar()
        if (this._pausado || this.video.readyState < 2) return
        if (this.video.currentTime === ultimoVideoTime) return

        const ahora = performance.now()

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

        this._alRecibirResultados(resultado)
        this.ui.actualizarPerfFrame(mpMs, fps)
      }
      programar()
    } finally {
      this._iniciandoCamara = false
    }
  }

  private _alCambiarVisibilidad(): void {
    this._pausado = document.hidden
    if (document.hidden) {
      this.motor.reiniciar(true)
      this.ui.estadoListo('idle')
      this.ui.limpiarMano()
    }
  }

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
          ? this.ui.mostrarToast('luz', 'Poca luz detectada: busca una fuente de luz frente a ti para mejorar la precisión.', 'warn', 0)
          : this.ui.ocultarToast('luz')
      }
    } catch {
      // SecurityError posible en contextos cross-origin
    }
  }

  private _vincularEventos(): void {
    document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const pestaña = btn.dataset['tab'] as typeof this.modo
        document.querySelectorAll('.mode-tab').forEach(b => {
          b.classList.remove('active', 'is-active')
          b.setAttribute('aria-selected', 'false')
        })
        btn.classList.add('active', 'is-active')
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

  private _alRecibirResultados(resultado: HandLandmarkerResult): void {
    const ancho = this.video.videoWidth
    const alto  = this.video.videoHeight
    if (ancho !== this.anchoCanvas || alto !== this.altoCanvas) {
      this.canvas.width  = ancho
      this.canvas.height = alto
      this.anchoCanvas   = ancho
      this.altoCanvas    = alto
    }

    if (++this._frameCount % 90 === 0) this._verificarLuminosidad()

    const ac = this.canvas.width, al = this.canvas.height
    this.ctx.save()
    this.ctx.clearRect(0, 0, ac, al)
    this.ctx.translate(ac, 0)
    this.ctx.scale(-1, 1)
    this.ctx.drawImage(this.video, 0, 0, ac, al)

    if (resultado.landmarks.length > 0) {
      const rawLandmarks = resultado.landmarks[0]
      const puntos        = rawLandmarks as unknown as Punto[]
      const lateralidad: Lateralidad = {
        label: resultado.handedness[0][0].categoryName as 'Left' | 'Right',
        score: resultado.handedness[0][0].score
      }

      this.ctx.setTransform(1, 0, 0, 1, 0, 0)

      const displayLandmarks = rawLandmarks.map(lm => ({ x: 1 - lm.x, y: lm.y, z: lm.z, visibility: lm.visibility }))
      this._drawingUtils!.drawConnectors(displayLandmarks, HandLandmarker.HAND_CONNECTIONS,
        { color: 'rgba(56,189,248,0.80)', lineWidth: 2 })
      this._drawingUtils!.drawLandmarks(displayLandmarks,
        { color: '#38BDF8', lineWidth: 0.5, radius: 3 })

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
