export class Splash {
  private root: HTMLElement | null
  private status: HTMLElement | null = null
  private emptyEl: HTMLElement | null = null

  constructor() {
    this.root = document.getElementById('splash-screen')
    if (this.root) {
      this.status = this.root.querySelector('.splash-status')
    }
  }

  mensaje(msg: string, esError = false): void {
    if (!this.status) return
    this.status.textContent = msg
    this.status.dataset.error = String(esError)
  }

  ocultar(): void {
    if (!this.root) return
    this.root.classList.add('is-hidden')
    const root = this.root
    setTimeout(() => { root.style.display = 'none' }, 400)
  }

  mostrarEstadoVacio(err: DOMException | null, onReintentar: () => void, _bloqueado = false): void {
    this.emptyEl = document.getElementById('empty-state')
    if (!this.emptyEl) return
    this.emptyEl.hidden = false
    const title = this.emptyEl.querySelector<HTMLElement>('.empty-state__title')
    if (title && err?.name === 'NotAllowedError') {
      title.textContent = 'YOSO necesita permiso para acceder a tu cámara.'
    }
    const retry = this.emptyEl.querySelector<HTMLButtonElement>('#es-retry')
    if (retry) {
      retry.onclick = onReintentar
    }
  }

  ocultarEstadoVacio(): void {
    if (this.emptyEl) this.emptyEl.hidden = true
  }
}
