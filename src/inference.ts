// ============================================================================
// INFERENCE.TS — Motor de IA YOSO
// ============================================================================
import type { Landmark, Handedness, CentroidesMap, InferenceInitOptions, DebugPayload, TopNItem } from './types'

// Declaraciones mínimas para onnxruntime-web (sin @types)
declare const ort: {
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown
  InferenceSession: {
    create: (path: string, opts?: object) => Promise<OrtSession>
  }
}

interface OrtSession {
  inputNames:  string[]
  outputNames: string[]
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>
}

export const ALPHABET: string[] = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  ' ', '\u232b'
]
export const BORRAR = '\u232b'

// ── Hiperparámetros ──────────────────────────────────────────────────────────
const UMBRAL_CONFIANZA    = 0.75
const PESO_GEO_MAX        = 0.15
const TAMANO_BUFFER       = 7
const VOTOS_NECESARIOS    = 5
const TIEMPO_COOLDOWN_MS  = 800
const COOLDOWN_COMANDO_MS = 400
const PUNTAS              = [4, 8, 12, 16, 20] as const

export class InferenceEngine {
  private session:    OrtSession | null = null
  private centroides: CentroidesMap | null = null

  // Buffers preallocados — evitan GC por frame
  private readonly coordBuf   = new Float32Array(42)
  private readonly featureBuf = new Float32Array(48)

  // Estado del buffer de votación
  private bufferPredicciones:    string[] = []
  private ultimaLetra:           string   = ''
  private ultimoTiempoEscritura: number   = 0

  // Callbacks
  private cb!: InferenceInitOptions['callbacks']

  // ── API pública ─────────────────────────────────────────────────────────────
  public init(opts: InferenceInitOptions): void {
    this.session    = opts.session as OrtSession
    this.centroides = opts.centroides
    this.cb         = opts.callbacks
  }

  public reset(): void {
    this.bufferPredicciones    = []
    this.ultimaLetra           = ''
    this.ultimoTiempoEscritura = 0
  }

  public async run(rawLandmarks: Landmark[], handedness: Handedness, jitter: number): Promise<void> {
    if (!this.session) return

    try {
      const t0 = performance.now()
      const isLeftCamera = handedness.label === 'Left'

      const inputCoords = this._preprocesar(rawLandmarks, isLeftCamera)
      const tensor      = new ort.Tensor('float32', inputCoords.slice(), [1, 48])
      const output      = await this.session.run({ [this.session.inputNames[0]]: tensor })
      const { probs, maxIndex, maxProb } = this._softmax(output[this.session.outputNames[0]].data)

      let letra = ALPHABET[maxIndex]
      letra = this._juezUR(letra, rawLandmarks, isLeftCamera)

      const { confianzaEfectiva, distancia, distRef } = this._filtroZonaGris(letra, inputCoords, maxProb)

      let letraDetectada = confianzaEfectiva >= UMBRAL_CONFIANZA ? letra : '-'
      if ((letraDetectada === ' ' || letraDetectada === BORRAR) && jitter > 0.02) {
        letraDetectada = '-'
      }

      const latencia = performance.now() - t0

      const top3: TopNItem[] = Array.from(probs)
        .map((p, i) => ({ letter: ALPHABET[i], prob: p }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3)

      this.cb.onLetraInstantanea(letraDetectada, confianzaEfectiva, latencia, isLeftCamera)
      this.cb.onDebugUpdate({
        probRed: maxProb, confEfectiva: confianzaEfectiva,
        distancia, distRef,
        bufferActual: [...this.bufferPredicciones],
        topN: top3
      } satisfies DebugPayload)

      // Majority vote
      this.bufferPredicciones.push(letraDetectada)
      if (this.bufferPredicciones.length > TAMANO_BUFFER) this.bufferPredicciones.shift()
      if (this.bufferPredicciones.length < TAMANO_BUFFER) return

      const counts: Record<string, number> = {}
      let maxChar = '', maxCount = 0
      for (const ch of this.bufferPredicciones) {
        counts[ch] = (counts[ch] ?? 0) + 1
        if (counts[ch] > maxCount) { maxCount = counts[ch]; maxChar = ch }
      }

      if (maxCount < VOTOS_NECESARIOS) return
      if (maxChar === '-') { this.ultimaLetra = ''; return }

      const ahora    = Date.now()
      const esComando = maxChar === ' ' || maxChar === BORRAR
      const cooldown  = esComando ? COOLDOWN_COMANDO_MS : TIEMPO_COOLDOWN_MS

      if (maxChar === this.ultimaLetra && !esComando) return
      if (ahora - this.ultimoTiempoEscritura < cooldown) return

      this.ultimaLetra           = maxChar
      this.ultimoTiempoEscritura = ahora
      this.bufferPredicciones    = []

      this.cb.onLetraConfirmada(maxChar)

    } catch (err) {
      console.error('[InferenceEngine] Error:', err)
    }
  }

  // ── Privados ─────────────────────────────────────────────────────────────────
  private _preprocesar(landmarks: Landmark[], isLeftCamera: boolean): Float32Array {
    const baseX = landmarks[0].x
    const baseY = landmarks[0].y

    for (let i = 0; i < 21; i++) {
      let dx = landmarks[i].x - baseX
      if (!isLeftCamera) dx *= -1
      this.coordBuf[i * 2]     = dx
      this.coordBuf[i * 2 + 1] = landmarks[i].y - baseY
    }

    const dp = Math.sqrt(this.coordBuf[18] ** 2 + this.coordBuf[19] ** 2)
    if (dp > 1e-6) {
      for (let i = 0; i < 42; i++) this.coordBuf[i] /= dp
    }

    this.featureBuf.set(this.coordBuf)
    this.featureBuf[42] = Math.atan2(this.coordBuf[19], this.coordBuf[18])
    for (let k = 0; k < 5; k++) {
      const p  = PUNTAS[k]
      const dx = this.coordBuf[p * 2]
      const dy = this.coordBuf[p * 2 + 1]
      this.featureBuf[43 + k] = Math.sqrt(dx * dx + dy * dy)
    }

    return this.featureBuf
  }

  private _softmax(logits: Float32Array): { probs: Float32Array; maxIndex: number; maxProb: number } {
    let maxLogit = -Infinity, maxIdx = 0
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxLogit) { maxLogit = logits[i]; maxIdx = i }
    }
    let expSum = 0
    const probs = new Float32Array(logits.length)
    for (let i = 0; i < logits.length; i++) {
      probs[i] = Math.exp(logits[i] - maxLogit)
      expSum  += probs[i]
    }
    let maxProb = 0
    for (let i = 0; i < probs.length; i++) {
      probs[i] /= expSum
      if (probs[i] > maxProb) maxProb = probs[i]
    }
    return { probs, maxIndex: maxIdx, maxProb }
  }

  private _juezUR(letra: string, landmarks: Landmark[], isLeftCamera: boolean): string {
    if (letra !== 'U' && letra !== 'R') return letra
    const cruzados = isLeftCamera
      ? landmarks[8].x < landmarks[12].x
      : landmarks[8].x > landmarks[12].x
    return cruzados ? 'R' : 'U'
  }

  private _filtroZonaGris(
    letra: string,
    inputCoords: Float32Array,
    probRed: number
  ): { confianzaEfectiva: number; distancia: number | null; distRef: number | null } {
    if (!this.centroides || letra === ' ' || letra === BORRAR) {
      return { confianzaEfectiva: probRed, distancia: null, distRef: null }
    }
    const entrada = this.centroides[letra.toLowerCase()]
    if (!entrada) return { confianzaEfectiva: probRed, distancia: null, distRef: null }

    let suma = 0
    for (let i = 0; i < entrada.coords.length; i++) {
      const d = inputCoords[i] - entrada.coords[i]
      suma += d * d
    }
    const distancia = Math.sqrt(suma)
    const distRef   = entrada.dist_ref

    if (probRed >= UMBRAL_CONFIANZA) return { confianzaEfectiva: probRed, distancia, distRef }

    const penalizacion      = Math.min(Math.max(0, distancia - distRef) / distRef, 1.0) * PESO_GEO_MAX
    const confianzaEfectiva = probRed * (1 - penalizacion)
    return { confianzaEfectiva, distancia, distRef }
  }
}
