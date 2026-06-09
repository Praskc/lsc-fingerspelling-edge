// ============================================================================
// HUD · Display de instrumento de 4 bloques
// La fachada pública (RenderizadorUI) llama estos métodos sin cambios.
// La estructura DOM ahora la crea PanelLeft; este módulo solo actualiza valores.
// ============================================================================

export class HUD {
  private mTime:   HTMLElement | null = null
  private mHand:   HTMLElement | null = null
  private mConf:   HTMLElement | null = null
  private mFps:    HTMLElement | null = null
  private predEl:  HTMLElement | null = null

  constructor() {
    // Diferido hasta primer uso porque PanelLeft puede no haber renderizado aún.
    queueMicrotask(() => this.bind())
  }

  private bind(): void {
    this.mTime  = document.getElementById('m-time')
    this.mHand  = document.getElementById('m-hand')
    this.mConf  = document.getElementById('m-conf')
    this.mFps   = document.getElementById('m-fps')
    this.predEl = document.getElementById('prediction')
  }

  estadoListo(_estado: 'idle' | 'signing' | 'warning'): void {
    // El indicador EN VIVO vive en PanelLeft; este método queda como no-op por ahora.
  }

  actualizarPrediccion(letra: string, confianza: number, latencia: number, _esIzquierda: boolean): void {
    if (this.predEl) this.predEl.textContent = letra || '·'
    if (this.mConf) {
      // Motor entrega confianza en 0..1; mostrar como porcentaje.
      const pct = confianza * 100
      this.mConf.innerHTML = `${pct.toFixed(0)}<span class="unit">%</span>`
      this.mConf.dataset.state = confianza >= 0.9 ? 'high' : 'on'
    }
    if (this.mTime) this.mTime.innerHTML = `${latencia.toFixed(1)}<span class="unit">ms</span>`
  }

  estadoMano(estado: string, esOptimo: boolean): void {
    if (!this.mHand) return
    this.mHand.textContent = estado || 'ND'
    this.mHand.dataset.state = esOptimo ? 'on' : 'off'
  }

  limpiarMano(): void {
    if (!this.mHand) return
    this.mHand.textContent = 'ND'
    this.mHand.dataset.state = 'off'
  }

  actualizarROI(_fueraZona: boolean): void {
    // El overlay ROI se mantiene en PanelLeft; aquí sin acción.
  }

  limpiarROI(): void {
    // No-op por ahora.
  }

  agregarLetra(letra: string, borrar: boolean): void {
    // La lógica de texto vive en OutputPanel ahora.
    window.dispatchEvent(new CustomEvent('yoso:letra', { detail: { letra, borrar } }))
  }

  limpiarTexto(): void {
    window.dispatchEvent(new CustomEvent('yoso:texto-clear'))
  }

  actualizarFps(fps: number): void {
    if (this.mFps) this.mFps.textContent = fps.toFixed(1)
  }
}
