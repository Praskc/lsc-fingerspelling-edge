// ============================================================================
// PANEL LEFT · Feed de cámara (video + canvas estáticos en index.html)
// Este módulo solo gestiona el indicador EN VIVO de la badge.
// ============================================================================

export class PanelLeft {
  private liveEl: HTMLElement | null = null
  private _prev = ''

  constructor() {
    this.liveEl = document.querySelector('.feed__live')
  }

  setLive(activo: boolean): void {
    if (!this.liveEl) return
    const estado = activo ? 'on' : 'off'
    if (estado === this._prev) return
    this._prev = estado
    this.liveEl.dataset.state = estado
  }
}
