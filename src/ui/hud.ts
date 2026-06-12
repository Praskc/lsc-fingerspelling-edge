// ============================================================================
// HUD · Actualiza los valores del sidebar Traductor.
// Los elementos son renderizados por OutputPanel; HUD los bindea en diferido.
// ============================================================================

const ARC_CIRCUMFERENCE = 263.9

export class HUD {
  private mTime:    HTMLElement | null = null
  private mHand:    HTMLElement | null = null
  private mEstado:  HTMLElement | null = null
  private mConf:    HTMLElement | null = null
  private arcFill:    SVGCircleElement | null = null
  private mFps:       HTMLElement | null = null
  private roiEl:      HTMLElement | null = null
  private _fueraZona  = false

  constructor() {
    queueMicrotask(() => this.bind())
  }

  private bind(): void {
    this.mTime   = document.getElementById('m-time')
    this.mHand   = document.getElementById('m-hand')
    this.mEstado = document.getElementById('m-estado')
    this.mConf   = document.getElementById('m-conf')
    this.arcFill    = document.getElementById('conf-arc-fill') as SVGCircleElement | null
    this.mFps       = document.getElementById('m-fps')
    this.roiEl      = document.querySelector('.feed__roi')
  }

  estadoListo(_estado: 'idle' | 'signing' | 'warning'): void {
    // El indicador EN VIVO vive en PanelLeft (feed__live).
  }

  actualizarPrediccion(_letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    const pct = Math.round(confianza * 100)
    if (this.mConf) {
      this.mConf.innerHTML = `${pct}<span class="unit">%</span>`
      this.mConf.dataset.state = confianza >= 0.9 ? 'high' : 'on'
    }
    if (this.arcFill) {
      this.arcFill.style.strokeDashoffset = String(ARC_CIRCUMFERENCE * (1 - pct / 100))
    }
    if (this.mTime) this.mTime.innerHTML = `${latencia.toFixed(1)}<span class="unit">ms</span>`

    // Lateralidad de la mano
    if (this.mHand) {
      this.mHand.textContent = esIzquierda ? 'izq.' : 'der.'
      this.mHand.dataset.state = 'on'
    }
  }

  estadoMano(_estado: string, esOptimo: boolean): void {
    if (!this.mEstado) return
    this.mEstado.textContent = esOptimo ? 'óptimo' : 'mov.'
    this.mEstado.dataset.state = esOptimo ? 'on' : 'warn'
  }

  limpiarMano(): void {
    if (this.mHand) {
      this.mHand.textContent = 'ND'
      this.mHand.dataset.state = 'off'
    }
    if (this.mEstado) {
      if (this._fueraZona) {
        this.mEstado.textContent = 'fuera'
        this.mEstado.dataset.state = 'warn'
      } else {
        this.mEstado.textContent = '·'
        this.mEstado.dataset.state = 'off'
      }
    }
    if (this.arcFill) this.arcFill.style.strokeDashoffset = String(ARC_CIRCUMFERENCE)
    if (this.mConf)  { this.mConf.innerHTML = `0<span class="unit">%</span>`; delete this.mConf.dataset.state }
    if (this.mTime)  this.mTime.innerHTML = `·<span class="unit">ms</span>`
  }

  actualizarROI(fueraZona: boolean): void {
    this._fueraZona = fueraZona
    if (!this.roiEl) return
    this.roiEl.setAttribute('data-state', fueraZona ? 'warning' : 'ok')
    const label = this.roiEl.querySelector('.feed__roi-label')
    if (label) label.textContent = fueraZona ? 'fuera del rango' : 'zona de detección'
  }

  limpiarROI(): void {
    this._fueraZona = false
    if (!this.roiEl) return
    this.roiEl.removeAttribute('data-state')
    const label = this.roiEl.querySelector('.feed__roi-label')
    if (label) label.textContent = 'zona de detección'
  }

  agregarLetra(letra: string, borrar: boolean): void {
    window.dispatchEvent(new CustomEvent('yoso:letra', { detail: { letra, borrar } }))
  }

  limpiarTexto(): void {
    window.dispatchEvent(new CustomEvent('yoso:texto-clear'))
  }

  actualizarFps(fps: number): void {
    if (this.mFps) this.mFps.textContent = fps.toFixed(1)
  }
}
