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
