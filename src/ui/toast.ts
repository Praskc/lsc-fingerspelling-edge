export class Toast {
  private readonly root:   HTMLElement
  private readonly timers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor() {
    this.root = document.getElementById('toast-root')!
  }

  mostrar(id: string, mensaje: string, tipo: 'info' | 'warn' | 'error' = 'info', duracion = 5000): void {
    this.ocultar(id)

    const toast = document.createElement('div')
    toast.className          = `toast toast-${tipo}`
    toast.dataset['toastId'] = id
    toast.setAttribute('role', 'alert')

    const icono = document.createElement('span')
    icono.className = 'toast-icon'
    const svgWarn  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    const svgError = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    const svgInfo  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    icono.innerHTML = tipo === 'warn' ? svgWarn : tipo === 'error' ? svgError : svgInfo

    const texto = document.createElement('span')
    texto.className   = 'toast-msg'
    texto.textContent = mensaje

    const cerrar = document.createElement('button')
    cerrar.className = 'toast-close'
    cerrar.innerHTML = '&times;'
    cerrar.setAttribute('aria-label', 'Cerrar notificación')
    cerrar.onclick = () => this.ocultar(id)

    toast.appendChild(icono)
    toast.appendChild(texto)
    toast.appendChild(cerrar)
    this.root.appendChild(toast)

    void toast.offsetWidth
    toast.classList.add('toast-visible')

    if (duracion > 0) {
      const timer = setTimeout(() => this.ocultar(id), duracion)
      this.timers.set(id, timer)
    }
  }

  ocultar(id: string): void {
    const existing = this.root.querySelector<HTMLElement>(`[data-toast-id="${id}"]`)
    if (existing) {
      existing.classList.remove('toast-visible')
      existing.classList.add('toast-saliendo')
      setTimeout(() => existing.remove(), 300)
    }
    const timer = this.timers.get(id)
    if (timer !== undefined) { clearTimeout(timer); this.timers.delete(id) }
  }
}
