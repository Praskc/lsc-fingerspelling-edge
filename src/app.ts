// ============================================================================
// APP.TS — Orquestador YOSO
// ============================================================================
import { InferenceEngine, BORRAR } from './inference'
import { GameManager }             from './game'
import type { HandsResult, Landmark, DebugPayload } from './types'

// Declaraciones MediaPipe (cargadas via CDN en index.html)
declare const Hands:            new (opts: object) => MediaPipeHands
declare const Camera:           new (el: HTMLVideoElement, opts: object) => { start: () => void }
declare const drawConnectors:   (ctx: CanvasRenderingContext2D, lms: Landmark[], conns: unknown, style: object) => void
declare const drawLandmarks:    (ctx: CanvasRenderingContext2D, lms: Landmark[], style: object) => void
declare const HAND_CONNECTIONS: unknown
declare const ort: {
  InferenceSession: {
    create: (path: string, opts?: object) => Promise<unknown>
  }
}

interface MediaPipeHands {
  setOptions:  (opts: object) => void
  onResults:   (cb: (r: HandsResult) => void) => void
  send:        (opts: { image: HTMLVideoElement }) => Promise<void>
}

// ── ROI límites ───────────────────────────────────────────────────────────────
const LIM_SUP = 0.25
const LIM_IZQ = 0.10
const LIM_DER = 0.90

export class YOSOApp {
  // Módulos
  private readonly engine: InferenceEngine
  private readonly game:   GameManager

  // DOM
  private readonly video:          HTMLVideoElement
  private readonly canvas:         HTMLCanvasElement
  private readonly ctx:            CanvasRenderingContext2D
  private readonly statusText:     HTMLElement
  private readonly predictionText: HTMLElement
  private readonly confidenceSpan: HTMLElement
  private readonly finalText:      HTMLElement
  private readonly roiOverlay:     HTMLElement
  private readonly metricTime:     HTMLElement
  private readonly metricHand:     HTMLElement
  private readonly metricStatus:   HTMLElement

  // Debug DOM
  private readonly dbRed:     HTMLElement
  private readonly dbBarRed:  HTMLElement
  private readonly dbEff:     HTMLElement
  private readonly dbBarEff:  HTMLElement
  private readonly dbDist:    HTMLElement
  private readonly dbBarDist: HTMLElement
  private readonly dbDistRef: HTMLElement
  private readonly dbVotes:   HTMLElement
  private readonly dbBuffer:  HTMLElement
  private readonly dbTop3:    HTMLElement

  // Estado
  private textoAcumulado:  string  = ''
  private modoEntrenamiento: boolean = false
  private prevCanvasW: number = 0
  private prevCanvasH: number = 0
  private prevWristX:  number = 0
  private prevWristY:  number = 0

  constructor() {
    this.engine = new InferenceEngine()
    this.game   = new GameManager()

    this.video          = document.querySelector('.input_video')!
    this.canvas         = document.querySelector('.output_canvas')!
    this.ctx            = this.canvas.getContext('2d')!
    this.statusText     = document.querySelector('.status-label')!
    this.predictionText = document.querySelector('.prediction')!
    this.confidenceSpan = document.querySelector('.confidence-val span')!
    this.finalText      = document.getElementById('final_text')!
    this.roiOverlay     = document.getElementById('roi-overlay')!
    this.metricTime     = document.getElementById('m-time')!
    this.metricHand     = document.getElementById('m-hand')!
    this.metricStatus   = document.getElementById('m-status')!

    this.dbRed     = document.getElementById('db-red')!
    this.dbBarRed  = document.getElementById('db-bar-red')!
    this.dbEff     = document.getElementById('db-eff')!
    this.dbBarEff  = document.getElementById('db-bar-eff')!
    this.dbDist    = document.getElementById('db-dist')!
    this.dbBarDist = document.getElementById('db-bar-dist')!
    this.dbDistRef = document.getElementById('db-distref')!
    this.dbVotes   = document.getElementById('db-votes')!
    this.dbBuffer  = document.getElementById('db-buffer')!
    this.dbTop3    = document.getElementById('db-top3')!

    this._bindEvents()
  }

  // ── Helper: READY TO SIGN indicator ──────────────────────────────────────────
  private _setReadyState(state: 'idle' | 'signing' | 'warning'): void {
    const el    = document.getElementById('ready-indicator')
    const label = document.getElementById('ready-label')
    if (!el || !label) return
    el.className = `ready-indicator ${state}`
    label.textContent = state === 'signing' ? 'SIGNING...'
                      : state === 'warning' ? 'OUT OF ZONE'
                      : 'READY TO SIGN'
  }

  // ── Arranque ─────────────────────────────────────────────────────────────────
  public async start(): Promise<void> {
    try {
      this.statusText.innerText = 'Cargando red neuronal…'

      const [session, centroidesRaw] = await Promise.all([
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

      this.engine.init({
        session,
        centroides,
        callbacks: {
          onLetraConfirmada:  (l) => this._onLetraConfirmada(l),
          onLetraInstantanea: (l, c, lat, left) => this._onLetraInstantanea(l, c, lat, left),
          onDebugUpdate:      (p) => this._onDebugUpdate(p)
        }
      })

      this.statusText.innerText = '✓ Lista'

    } catch (e) {
      this.statusText.innerText = '✗ Error: YOSO.onnx'
      console.error('[YOSO] Init fallido:', e)
      return
    }

    const hands = new Hands({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    })
    hands.setOptions({
      maxNumHands:            1,
      modelComplexity:        0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence:  0.5
    })
    hands.onResults((r) => this._onResults(r))

    new Camera(this.video, {
      onFrame: async () => { await hands.send({ image: this.video }) },
      width: 1280, height: 720
    }).start()
  }

  // ── Eventos ───────────────────────────────────────────────────────────────────
  private _bindEvents(): void {
    // ── Tabs ──────────────────────────────────────────────────────────────────
    document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset['tab']!
        document.querySelectorAll('.mode-tab').forEach(b => {
          b.classList.remove('active')
          b.setAttribute('aria-selected', 'false')
        })
        btn.classList.add('active')
        btn.setAttribute('aria-selected', 'true')
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
        document.getElementById(`tab-${tab}`)?.classList.add('active')

        const esEntrenamiento = tab === 'entrenamiento'
        if (esEntrenamiento !== this.modoEntrenamiento) {
          this.modoEntrenamiento   = esEntrenamiento
          this.textoAcumulado      = ''
          this.finalText.innerText = ''
          this.engine.reset()
          esEntrenamiento ? void this.game.activar() : this.game.desactivar()
        }
      })
    })

    // ── Debug toggle (checkbox) ───────────────────────────────────────────────
    const debugCheckbox = document.getElementById('debug-checkbox') as HTMLInputElement | null
    const debugPanel    = document.getElementById('debug-panel')
    if (debugCheckbox && debugPanel) {
      debugCheckbox.addEventListener('change', () => {
        debugPanel.style.display = debugCheckbox.checked ? 'block' : 'none'
      })
    }
  }

  // ── Callbacks inference ───────────────────────────────────────────────────────
  private _onLetraInstantanea(
    letra: string, confianza: number, latencia: number, isLeftCamera: boolean
  ): void {
    this.metricTime.innerText = latencia.toFixed(1) + ' ms'
    this.metricHand.innerText = isLeftCamera ? 'DERECHA' : 'IZQUIERDA'
    if (letra !== '-') {
      this.predictionText.innerText = letra
      this.confidenceSpan.innerText = (confianza * 100).toFixed(1) + '%'
    } else {
      this.predictionText.innerText = '_'
      this.confidenceSpan.innerText = 'Buscando...'
    }
  }

  private _onLetraConfirmada(letra: string): void {
    if (this.modoEntrenamiento) {
      this.game.onLetraConfirmada(letra)
      return
    }
    if (letra === ' ') {
      this.textoAcumulado += ' '
    } else if (letra === BORRAR) {
      this.textoAcumulado = this.textoAcumulado.slice(0, -1)
    } else {
      this.textoAcumulado += letra
    }
    this.finalText.innerText        = this.textoAcumulado
    this.predictionText.style.color = 'var(--accent-live)'
    setTimeout(() => { this.predictionText.style.color = '' }, 300)
  }

  private _onDebugUpdate(p: DebugPayload): void {
    const pRed = (p.probRed * 100).toFixed(1)
    const pEff = (p.confEfectiva * 100).toFixed(1)
    this.dbRed.textContent          = pRed + '%'
    this.dbEff.textContent          = pEff + '%'
    ;(this.dbBarRed as HTMLElement & { style: CSSStyleDeclaration }).style.width = pRed + '%'
    ;(this.dbBarEff as HTMLElement & { style: CSSStyleDeclaration }).style.width = pEff + '%'
    this.dbBarEff.classList.toggle('below-threshold', p.confEfectiva < 0.75)

    if (p.distancia !== null && p.distRef !== null) {
      const pct = Math.min((p.distancia / (p.distRef * 2)) * 100, 100).toFixed(0)
      this.dbDist.textContent    = p.distancia.toFixed(3) + ' / ' + p.distRef.toFixed(3)
      ;(this.dbBarDist as HTMLElement & { style: CSSStyleDeclaration }).style.width = pct + '%'
      this.dbBarDist.classList.toggle('high-dist', p.distancia > p.distRef * 1.5)
      this.dbDistRef.textContent = 'P75=' + p.distRef.toFixed(3)
    } else {
      this.dbDist.textContent    = '—'
      ;(this.dbBarDist as HTMLElement & { style: CSSStyleDeclaration }).style.width = '0%'
      this.dbDistRef.textContent = '—'
    }

    this.dbBuffer.innerHTML = ''
    const winner = p.bufferActual.length
      ? p.bufferActual.reduce((a, b, _, arr) =>
          arr.filter(x => x === a).length >= arr.filter(x => x === b).length ? a : b
        , p.bufferActual[0]) : ''

    Array(10).fill('').map((_, i) => p.bufferActual[i] ?? '').forEach(ch => {
      const cell     = document.createElement('span')
      cell.className = 'vote-cell ' + (
        ch === ''     ? 'vote-empty' :
        ch === '-'    ? 'vote-miss'  :
        ch === winner ? 'vote-hit vote-winner' : 'vote-hit'
      )
      cell.textContent = ch === '' ? '·' : ch === '-' ? '✗' : ch
      this.dbBuffer.appendChild(cell)
    })
    this.dbVotes.textContent = winner
      ? `${winner}: ${p.bufferActual.filter(x => x === winner).length}/10`
      : '—'

    // Fix XSS: createElement en vez de innerHTML — item.letter viene del modelo
    this.dbTop3.textContent = ''
    p.topN.forEach((item, idx) => {
      const wrapper = document.createElement('span')
      wrapper.className = `top3-item${idx === 0 ? ' t3-winner' : ''}`

      const letter = document.createElement('span')
      letter.className   = 't3-letter'
      letter.textContent = item.letter   // textContent escapa automáticamente

      const prob = document.createElement('span')
      prob.className   = 't3-prob'
      prob.textContent = (item.prob * 100).toFixed(1) + '%'

      wrapper.appendChild(letter)
      wrapper.appendChild(document.createTextNode(' '))
      wrapper.appendChild(prob)
      this.dbTop3.appendChild(wrapper)
    })
  }

  // ── Pipeline MediaPipe ────────────────────────────────────────────────────────
  private _onResults(results: HandsResult): void {
    if (results.image) {
      const img = results.image as HTMLVideoElement
      const w = img.videoWidth || (img as unknown as HTMLCanvasElement).width
      const h = img.videoHeight || (img as unknown as HTMLCanvasElement).height
      if (w !== this.prevCanvasW || h !== this.prevCanvasH) {
        this.canvas.width  = w
        this.canvas.height = h
        this.prevCanvasW   = w
        this.prevCanvasH   = h
      }
    }

    const cw = this.canvas.width, ch = this.canvas.height
    this.ctx.save()
    this.ctx.clearRect(0, 0, cw, ch)
    this.ctx.translate(cw, 0)
    this.ctx.scale(-1, 1)
    this.ctx.drawImage(results.image as CanvasImageSource, 0, 0, cw, ch)

    if (results.multiHandLandmarks?.length > 0) {
      const landmarks  = results.multiHandLandmarks[0]
      const handedness = results.multiHandedness[0]

      // Landmarks estilo cyan suave sobre navy
      drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS,
        { color: 'rgba(56,189,248,0.45)', lineWidth: 1.5 })
      drawLandmarks(this.ctx, landmarks,
        { color: 'rgba(56,189,248,0.85)', lineWidth: 0.5, radius: 2 })

      this.ctx.setTransform(1, 0, 0, 1, 0, 0)

      let minX = 1, minY = 1, maxX = 0
      for (const lm of landmarks) {
        if (lm.x < minX) minX = lm.x
        if (lm.y < minY) minY = lm.y
        if (lm.x > maxX) maxX = lm.x
      }
      const fueraZona = minY < LIM_SUP || minX < LIM_IZQ || maxX > LIM_DER

      this.roiOverlay.classList.toggle('roi-fuera',  fueraZona)
      this.roiOverlay.classList.toggle('roi-activa', !fueraZona)

      if (fueraZona) {
        this._setReadyState('warning')
        this.engine.reset()
        this.predictionText.innerText = '_'
        this.confidenceSpan.innerText = '--'
        this.metricStatus.innerText   = 'Fuera de zona'
        this.metricStatus.className   = 'hud-val status-warning'
        this.ctx.restore()
        return
      }

      this._setReadyState('signing')

      const wrist  = landmarks[0]
      const jitter = Math.abs(wrist.x - this.prevWristX) + Math.abs(wrist.y - this.prevWristY)
      this.prevWristX = wrist.x
      this.prevWristY = wrist.y

      this.metricStatus.innerText = jitter > 0.03 ? 'Inestable' : 'Óptimo'
      this.metricStatus.className = jitter > 0.03 ? 'hud-val status-warning' : 'hud-val status-ok'

      void this.engine.run(landmarks, handedness, jitter)

    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this._setReadyState('idle')
      this.engine.reset()
      this.predictionText.innerText = '_'
      this.confidenceSpan.innerText = '--'
      this.metricHand.innerText     = 'ND'
      this.metricTime.innerText     = '-- ms'
      this.metricStatus.innerText   = 'Esperando'
      this.metricStatus.className   = 'hud-val'
      this.roiOverlay.classList.remove('roi-fuera', 'roi-activa')
    }

    this.ctx.restore()
  }
}