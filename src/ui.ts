// ============================================================================
// UI.TS — Capa de renderizado DOM (sin lógica de negocio)
// ============================================================================
import { signURI }           from './signs'
import type { CargaDebug }   from './types'

export class RenderizadorUI {
  // ── HUD / predicción ──────────────────────────────────────────────────────
  private readonly elIndicadorListo: HTMLElement
  private readonly elEtiquetaListo:  HTMLElement
  private readonly elPrediccion:     HTMLElement
  private readonly elConfianza:      HTMLElement
  private readonly elMetricaTiempo:  HTMLElement
  private readonly elMetricaMano:    HTMLElement
  private readonly elMetricaEstado:  HTMLElement

  // ── Traductor ─────────────────────────────────────────────────────────────
  private readonly elTextoFinal:     HTMLElement

  // ── ROI ───────────────────────────────────────────────────────────────────
  private readonly elROI:            HTMLElement

  // ── Panel de depuración ───────────────────────────────────────────────────
  private readonly dbRojo:      HTMLElement
  private readonly dbBarRojo:   HTMLElement
  private readonly dbEfectivo:  HTMLElement
  private readonly dbBarEfect:  HTMLElement
  private readonly dbDist:      HTMLElement
  private readonly dbBarDist:   HTMLElement
  private readonly dbDistRef:   HTMLElement
  private readonly dbVotos:     HTMLElement
  private readonly dbBuffer:    HTMLElement
  private readonly dbTop3:      HTMLElement

  // ── Splash ────────────────────────────────────────────────────────────────
  private readonly elSplash:    HTMLElement
  private readonly elMsgSplash: HTMLElement

  // ── Aprendizaje ───────────────────────────────────────────────────────────
  private readonly elAlfabeto: HTMLElement
  private senaActiva = ''

  // ── Estado traductor ──────────────────────────────────────────────────────
  private textoAcumulado = ''

  constructor() {
    this.elIndicadorListo = document.getElementById('ready-indicator')!
    this.elEtiquetaListo  = document.getElementById('ready-label')!
    this.elPrediccion     = document.querySelector('.prediction')!
    this.elConfianza      = document.querySelector('.confidence-val span')!
    this.elMetricaTiempo  = document.getElementById('m-time')!
    this.elMetricaMano    = document.getElementById('m-hand')!
    this.elMetricaEstado  = document.getElementById('m-status')!
    this.elTextoFinal     = document.getElementById('final_text')!
    this.elROI            = document.getElementById('roi-overlay')!
    this.dbRojo           = document.getElementById('db-red')!
    this.dbBarRojo        = document.getElementById('db-bar-red')!
    this.dbEfectivo       = document.getElementById('db-eff')!
    this.dbBarEfect       = document.getElementById('db-bar-eff')!
    this.dbDist           = document.getElementById('db-dist')!
    this.dbBarDist        = document.getElementById('db-bar-dist')!
    this.dbDistRef        = document.getElementById('db-distref')!
    this.dbVotos          = document.getElementById('db-votes')!
    this.dbBuffer         = document.getElementById('db-buffer')!
    this.dbTop3           = document.getElementById('db-top3')!
    this.elSplash         = document.getElementById('splash-screen')!
    this.elMsgSplash      = document.getElementById('splash-msg')!
    this.elAlfabeto       = document.getElementById('alphabet-grid')!

    this._construirAlfabeto()
    this._vincularDebug()
  }

  // ── Splash ────────────────────────────────────────────────────────────────
  mensajeSplash(mensaje: string, esError = false): void {
    this.elMsgSplash.textContent = mensaje
    this.elMsgSplash.classList.toggle('splash-error', esError)
  }

  ocultarSplash(): void {
    this.elSplash.classList.add('splash-hidden')
  }

  ocultarSkeleton(): void {
    document.getElementById('canvas-skeleton')?.classList.add('skeleton-oculto')
  }

  // ── Indicador de listo ────────────────────────────────────────────────────
  estadoListo(estado: 'idle' | 'signing' | 'warning'): void {
    this.elIndicadorListo.className = `ready-indicator ${estado}`
    this.elEtiquetaListo.textContent = estado === 'signing' ? 'FIRMANDO...'
                                     : estado === 'warning' ? 'FUERA DE ZONA'
                                     : 'LISTO PARA FIRMAR'
  }

  // ── ROI ───────────────────────────────────────────────────────────────────
  actualizarROI(fueraZona: boolean): void {
    this.elROI.classList.toggle('roi-fuera',  fueraZona)
    this.elROI.classList.toggle('roi-activa', !fueraZona)
  }

  limpiarROI(): void {
    this.elROI.classList.remove('roi-fuera', 'roi-activa')
  }

  // ── Predicción / HUD ──────────────────────────────────────────────────────
  actualizarPrediccion(letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    this.elMetricaTiempo.textContent = latencia.toFixed(1) + ' ms'
    this.elMetricaMano.textContent   = esIzquierda ? 'DERECHA' : 'IZQUIERDA'
    if (letra !== '-') {
      this.elPrediccion.textContent = letra
      this.elConfianza.textContent  = (confianza * 100).toFixed(1) + '%'
    } else {
      this.elPrediccion.textContent = '_'
      this.elConfianza.textContent  = 'Buscando...'
    }
  }

  estadoMano(estado: string, esOptimo: boolean): void {
    this.elMetricaEstado.textContent = estado
    this.elMetricaEstado.className   = esOptimo ? 'hud-val status-ok' : 'hud-val status-warning'
  }

  limpiarMano(): void {
    this.elPrediccion.textContent    = '_'
    this.elConfianza.textContent     = '--'
    this.elMetricaMano.textContent   = 'ND'
    this.elMetricaTiempo.textContent = '-- ms'
    this.elMetricaEstado.textContent = 'Esperando'
    this.elMetricaEstado.className   = 'hud-val'
  }

  // ── Texto traducido ───────────────────────────────────────────────────────
  agregarLetra(letra: string, borrar: boolean): void {
    if (borrar) {
      this.textoAcumulado = this.textoAcumulado.slice(0, -1)
    } else {
      this.textoAcumulado += letra
    }
    this.elTextoFinal.textContent = this.textoAcumulado
    this._destelloConfirmado()
  }

  limpiarTexto(): void {
    this.textoAcumulado           = ''
    this.elTextoFinal.textContent = ''
  }

  // ── Panel de depuración ───────────────────────────────────────────────────
  actualizarDebug(p: CargaDebug): void {
    const pRojo = (p.probRed      * 100).toFixed(1)
    const pEfec = (p.confEfectiva * 100).toFixed(1)

    this.dbRojo.textContent         = pRojo + '%'
    this.dbEfectivo.textContent     = pEfec + '%'
    this.dbBarRojo.style.width      = pRojo + '%'
    this.dbBarEfect.style.width     = pEfec + '%'
    this.dbBarEfect.classList.toggle('below-threshold', p.confEfectiva < 0.75)

    if (p.distancia !== null && p.distRef !== null) {
      const pct = Math.min((p.distancia / (p.distRef * 2)) * 100, 100).toFixed(0)
      this.dbDist.textContent        = p.distancia.toFixed(3) + ' / ' + p.distRef.toFixed(3)
      this.dbBarDist.style.width     = pct + '%'
      this.dbBarDist.classList.toggle('high-dist', p.distancia > p.distRef * 1.5)
      this.dbDistRef.textContent     = 'P75=' + p.distRef.toFixed(3)
    } else {
      this.dbDist.textContent        = '—'
      this.dbBarDist.style.width     = '0%'
      this.dbDistRef.textContent     = '—'
    }

    // Celdas de votos del buffer
    const ganador = this._ganadorBuffer(p.bufferActual)
    this.dbBuffer.textContent = ''
    Array(10).fill('').map((_, i) => p.bufferActual[i] ?? '').forEach(ch => {
      const celda     = document.createElement('span')
      celda.className = 'vote-cell ' + (
        ch === ''      ? 'vote-empty' :
        ch === '-'     ? 'vote-miss'  :
        ch === ganador ? 'vote-hit vote-winner' : 'vote-hit'
      )
      celda.textContent = ch === '' ? '·' : ch === '-' ? '✗' : ch
      this.dbBuffer.appendChild(celda)
    })
    this.dbVotos.textContent = ganador
      ? `${ganador}: ${p.bufferActual.filter(x => x === ganador).length}/10`
      : '—'

    // Top-3
    this.dbTop3.textContent = ''
    p.topN.forEach((item, idx) => {
      const contenedor = document.createElement('span')
      contenedor.className = `top3-item${idx === 0 ? ' t3-winner' : ''}`
      const elLetra = document.createElement('span')
      elLetra.className   = 't3-letter'
      elLetra.textContent = item.letra
      const elProb = document.createElement('span')
      elProb.className   = 't3-prob'
      elProb.textContent = (item.prob * 100).toFixed(1) + '%'
      contenedor.appendChild(elLetra)
      contenedor.appendChild(document.createTextNode(' '))
      contenedor.appendChild(elProb)
      this.dbTop3.appendChild(contenedor)
    })
  }

  // ── Aprendizaje — grid del alfabeto ───────────────────────────────────────
  resaltarSena(letra: string): void {
    if (letra === this.senaActiva) return
    this.limpiarSena()
    this.senaActiva = letra
    const tarjeta = this.elAlfabeto.querySelector<HTMLElement>(`[data-letra="${letra}"]`)
    if (tarjeta) {
      tarjeta.classList.add('sign-card-active')
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  limpiarSena(): void {
    if (!this.senaActiva) return
    this.elAlfabeto
      .querySelector(`[data-letra="${this.senaActiva}"]`)
      ?.classList.remove('sign-card-active')
    this.senaActiva = ''
  }

  // ── Privados ──────────────────────────────────────────────────────────────
  private _construirAlfabeto(): void {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letra => {
      const tarjeta = document.createElement('div')
      tarjeta.className          = 'sign-card'
      tarjeta.dataset['letra']   = letra

      const img = document.createElement('img')
      img.src       = signURI(letra)
      img.alt       = letra
      img.className = 'sign-card-img'

      const etiqueta = document.createElement('span')
      etiqueta.className   = 'sign-card-label'
      etiqueta.textContent = letra

      tarjeta.appendChild(img)
      tarjeta.appendChild(etiqueta)
      this.elAlfabeto.appendChild(tarjeta)
    })
  }

  private _vincularDebug(): void {
    const checkbox = document.getElementById('debug-checkbox') as HTMLInputElement | null
    const panel    = document.getElementById('debug-panel')
    if (checkbox && panel) {
      checkbox.addEventListener('change', () => {
        panel.style.display = checkbox.checked ? 'block' : 'none'
      })
    }
  }

  private _ganadorBuffer(buffer: string[]): string {
    if (!buffer.length) return ''
    const conteo: Record<string, number> = {}
    let ganador = '', maximo = 0
    for (const ch of buffer) {
      conteo[ch] = (conteo[ch] ?? 0) + 1
      if (conteo[ch] > maximo) { maximo = conteo[ch]; ganador = ch }
    }
    return ganador
  }

  private _destelloConfirmado(): void {
    this.elPrediccion.style.color = 'var(--cyan)'
    setTimeout(() => { this.elPrediccion.style.color = '' }, 300)
  }
}
