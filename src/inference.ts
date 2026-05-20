// ============================================================================
// INFERENCE.TS — Motor de inferencia YOSO
// ============================================================================
import * as ort from 'onnxruntime-web'
import type { Punto, Lateralidad, MapaCentroides, OpcionesInicioInferencia, CargaDebug, ItemTop } from './types'

export const ALFABETO: string[] = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  ' ', '⌫'
]
export const BORRAR = '⌫'

// ── Hiperparámetros ──────────────────────────────────────────────────────────
const UMBRAL_CONFIANZA       = 0.82   // subido de 0.75 — filtra detecciones en zona gris por luz adversa
const PESO_GEO_MAX           = 0.20   // penalización geométrica más agresiva
const TAMANO_BUFFER          = 9      // más frames para consenso
const VOTOS_NECESARIOS       = 7      // de 9 frames, 7 deben coincidir
const TIEMPO_COOLDOWN_MS     = 800
const COOLDOWN_MISMA_LETRA   = 1800
const COOLDOWN_COMANDO_MS    = 400
// Suma mínima de pesos para confirmar — más exigente
const PESO_MINIMO_VOTOS      = VOTOS_NECESARIOS * UMBRAL_CONFIANZA  // 7 × 0.82 = 5.74
const PUNTAS                 = [4, 8, 12, 16, 20] as const

export class MotorInferencia {
  private sesion:     ort.InferenceSession | null = null
  private centroides: MapaCentroides | null = null

  // Buffers preasignados — evitan GC por frame
  private readonly bufCoords   = new Float32Array(42)
  private readonly bufFeatures = new Float32Array(48)
  private          bufSoftmax  = new Float32Array(0)   // se dimensiona en primer uso

  // Estado del buffer de votación ponderada
  private bufferVotos: Array<{ letra: string; peso: number }> = []
  private ultimaLetra:           string = ''
  private ultimoTiempoEscritura: number = 0
  private _procesando = false

  private cb!: OpcionesInicioInferencia['callbacks']

  // ── API pública ──────────────────────────────────────────────────────────────
  public iniciar(opts: OpcionesInicioInferencia): void {
    this.sesion     = opts.sesion as ort.InferenceSession
    this.centroides = opts.centroides
    this.cb         = opts.callbacks
  }

  // forzar=false (default): solo limpia buffer — ultimaLetra y ultimoTiempoEscritura
  // se preservan para que el cooldown sobreviva parpadeos del detector.
  // forzar=true: reset completo (cambio de modo, tab oculto).
  public reiniciar(forzar = false): void {
    this.bufferVotos = []
    this._procesando = false
    if (forzar) {
      this.ultimaLetra           = ''
      this.ultimoTiempoEscritura = 0
    }
  }

  public async procesar(puntos: Punto[], lateralidad: Lateralidad, jitter: number): Promise<void> {
    if (!this.sesion || this._procesando) return
    this._procesando = true
    try {
      const esCamaraIzquierda = lateralidad.label === 'Left'

      const t0Proc   = performance.now()
      const entrada  = this._preprocesar(puntos, esCamaraIzquierda)
      if (entrada === null) return  // mano ocluida o dp ≈ 0 — descartar frame

      // Sin .slice(): _procesando garantiza que bufFeatures no se muta durante session.run
      const tensor = new ort.Tensor('float32', entrada, [1, 48])

      const t0Inf         = performance.now()
      const salida        = await this.sesion.run({ [this.sesion.inputNames[0]]: tensor })
      const latInferencia = performance.now() - t0Inf

      const datos = salida[this.sesion.outputNames[0]].data as Float32Array
      const { probs, indicePico, probPico } = this._softmax(datos)

      let letra = ALFABETO[indicePico]
      letra = this._juezUR(letra, puntos, esCamaraIzquierda)

      const { confianzaEfectiva, distancia, distRef } = this._filtroZonaGris(letra, entrada, probPico)
      const latProcesamiento = performance.now() - t0Proc

      let letraDetectada = confianzaEfectiva >= UMBRAL_CONFIANZA ? letra : '-'
      if ((letraDetectada === ' ' || letraDetectada === BORRAR) && jitter > 0.02) letraDetectada = '-'

      const top3: ItemTop[] = Array.from(probs)
        .map((p, i) => ({ letra: ALFABETO[i], prob: p }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3)

      // Actualizar buffer antes de callbacks → bufferProgreso refleja el frame actual
      this.bufferVotos.push({ letra: letraDetectada, peso: letraDetectada === '-' ? 0 : confianzaEfectiva })
      if (this.bufferVotos.length > TAMANO_BUFFER) this.bufferVotos.shift()

      const pesoPorLetra: Record<string, number> = {}
      let candidato = '', pesoCandidato = 0
      for (const { letra: l, peso } of this.bufferVotos) {
        if (l === '-') continue
        pesoPorLetra[l] = (pesoPorLetra[l] ?? 0) + peso
        if (pesoPorLetra[l] > pesoCandidato) { pesoCandidato = pesoPorLetra[l]; candidato = l }
      }
      const bufferProgreso = this.bufferVotos.length >= TAMANO_BUFFER
        ? Math.min(pesoCandidato / PESO_MINIMO_VOTOS, 1.0)
        : 0

      this.cb.alDetectarLetra(letraDetectada, confianzaEfectiva, latInferencia, latProcesamiento, esCamaraIzquierda)
      this.cb.alActualizarDebug({
        probRed: probPico, confEfectiva: confianzaEfectiva,
        distancia, distRef,
        bufferActual: this.bufferVotos.map(v => v.letra),
        topN:         top3,
        bufferProgreso
      } satisfies CargaDebug)

      if (this.bufferVotos.length < TAMANO_BUFFER) return
      if (pesoCandidato < PESO_MINIMO_VOTOS) return
      if (candidato === '') { this.ultimaLetra = ''; return }

      const ahora        = Date.now()
      const esComando    = candidato === ' ' || candidato === BORRAR
      const esMismaLetra = candidato === this.ultimaLetra && !esComando
      const cooldown     = esComando    ? COOLDOWN_COMANDO_MS
                         : esMismaLetra ? COOLDOWN_MISMA_LETRA
                         : TIEMPO_COOLDOWN_MS

      if (ahora - this.ultimoTiempoEscritura < cooldown) return

      this.ultimaLetra           = candidato
      this.ultimoTiempoEscritura = ahora
      this.bufferVotos           = []

      this.cb.alConfirmarLetra(candidato)

    } catch (err) {
      console.error('[MotorInferencia] Error:', err)
    } finally {
      this._procesando = false
    }
  }

  // ── Privados ─────────────────────────────────────────────────────────────────
  private _preprocesar(puntos: Punto[], esCamaraIzquierda: boolean): Float32Array | null {
    const baseX = puntos[0].x
    const baseY = puntos[0].y

    for (let i = 0; i < 21; i++) {
      let dx = puntos[i].x - baseX
      if (!esCamaraIzquierda) dx *= -1
      this.bufCoords[i * 2]     = dx
      this.bufCoords[i * 2 + 1] = puntos[i].y - baseY
    }

    const dp = Math.sqrt(this.bufCoords[18] ** 2 + this.bufCoords[19] ** 2)
    if (dp <= 1e-4) return null  // mano ocluida — descartar frame

    for (let i = 0; i < 42; i++) this.bufCoords[i] /= dp

    this.bufFeatures.set(this.bufCoords)
    this.bufFeatures[42] = Math.atan2(this.bufCoords[19], this.bufCoords[18])
    for (let k = 0; k < 5; k++) {
      const p  = PUNTAS[k]
      const dx = this.bufCoords[p * 2]
      const dy = this.bufCoords[p * 2 + 1]
      this.bufFeatures[43 + k] = Math.sqrt(dx * dx + dy * dy)
    }

    return this.bufFeatures
  }

  private _softmax(logits: Float32Array): { probs: Float32Array; indicePico: number; probPico: number } {
    if (this.bufSoftmax.length !== logits.length) {
      this.bufSoftmax = new Float32Array(logits.length)
    }
    let maxLogit = -Infinity, indicePico = 0
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxLogit) { maxLogit = logits[i]; indicePico = i }
    }
    let sumaExp = 0
    for (let i = 0; i < logits.length; i++) {
      this.bufSoftmax[i] = Math.exp(logits[i] - maxLogit)
      sumaExp += this.bufSoftmax[i]
    }
    let probPico = 0
    for (let i = 0; i < this.bufSoftmax.length; i++) {
      this.bufSoftmax[i] /= sumaExp
      if (this.bufSoftmax[i] > probPico) probPico = this.bufSoftmax[i]
    }
    return { probs: this.bufSoftmax, indicePico, probPico }
  }

  private _juezUR(letra: string, puntos: Punto[], esCamaraIzquierda: boolean): string {
    if (letra !== 'U' && letra !== 'R') return letra
    const cruzados = esCamaraIzquierda
      ? puntos[8].x < puntos[12].x
      : puntos[8].x > puntos[12].x
    return cruzados ? 'R' : 'U'
  }

  private _filtroZonaGris(
    letra: string,
    entrada: Float32Array,
    probRed: number
  ): { confianzaEfectiva: number; distancia: number | null; distRef: number | null } {
    if (!this.centroides || letra === ' ' || letra === BORRAR) {
      return { confianzaEfectiva: probRed, distancia: null, distRef: null }
    }
    const centroide = this.centroides[letra.toLowerCase()]
    if (!centroide) return { confianzaEfectiva: probRed, distancia: null, distRef: null }

    let suma = 0
    for (let i = 0; i < centroide.coords.length; i++) {
      const d = entrada[i] - centroide.coords[i]
      suma += d * d
    }
    const distancia = Math.sqrt(suma)
    const distRef   = centroide.dist_ref

    if (probRed >= UMBRAL_CONFIANZA) return { confianzaEfectiva: probRed, distancia, distRef }

    const penalizacion      = Math.min(Math.max(0, distancia - distRef) / distRef, 1.0) * PESO_GEO_MAX
    const confianzaEfectiva = probRed * (1 - penalizacion)
    return { confianzaEfectiva, distancia, distRef }
  }
}

