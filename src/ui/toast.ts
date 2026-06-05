// ============================================================================
// TOAST · Notificaciones discretas con eyebrow tipográfico
// Mantiene API: mostrar(id, msg, tipo, dur), ocultar(id).
// ============================================================================

type Tipo = 'info' | 'warn' | 'error'

const ETIQUETAS: Record<Tipo, string> = {
  info:  'INFO',
  warn:  'AVISO',
  error: 'ERROR',
}

export class Toast {
  private root: HTMLElement | null
  private activos = new Map<string, { el: HTMLElement; timer: number }>()

  constructor() {
    this.root = document.getElementById('toast-root')
  }

  mostrar(id: string, msg: string, tipo: Tipo = 'info', dur = 5000): void {
    if (!this.root) return
    this.ocultar(id)
    const el = document.createElement('div')
    el.className = 'toast'
    el.dataset.type = tipo
    el.innerHTML = `
      <span class="toast__eyebrow">${ETIQUETAS[tipo]}</span>
      <span class="toast__msg"></span>
    `
    el.querySelector('.toast__msg')!.textContent = msg
    this.root.appendChild(el)
    const timer = window.setTimeout(() => this.ocultar(id), dur)
    this.activos.set(id, { el, timer })
  }

  ocultar(id: string): void {
    const entry = this.activos.get(id)
    if (!entry) return
    clearTimeout(entry.timer)
    entry.el.classList.add('is-leaving')
    setTimeout(() => entry.el.remove(), 180)
    this.activos.delete(id)
  }
}
