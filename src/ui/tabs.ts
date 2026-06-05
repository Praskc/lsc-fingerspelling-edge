// ============================================================================
// TABS · Controlador de cambio entre los 3 modos
// ============================================================================

export type Modo = 'traductor' | 'entrenamiento' | 'aprendizaje'

const MODOS: Modo[] = ['traductor', 'entrenamiento', 'aprendizaje']
const META: Record<Modo, { numero: string; nombre: string; sub: string }> = {
  traductor:     { numero: '01', nombre: 'TRADUCTOR',     sub: 'LSC → texto' },
  entrenamiento: { numero: '02', nombre: 'ENTRENAMIENTO', sub: 'juego dactilológico' },
  aprendizaje:   { numero: '03', nombre: 'APRENDIZAJE',   sub: 'alfabeto LSC' },
}

export class Tabs {
  private bar: HTMLElement
  private actual: Modo = 'traductor'
  private onChange?: (modo: Modo) => void

  constructor() {
    this.bar = document.getElementById('tabs-bar')!
    if (!this.bar) return
    this.render()
    this.bar.addEventListener('click', this.handleClick)
  }

  private render(): void {
    this.bar.innerHTML = MODOS.map(m => {
      const meta = META[m]
      const selected = m === this.actual
      // Doble clase y doble dataset: tab-card para mi controller, mode-tab + data-tab
      // para que app.ts (_vincularEventos) lo siga conectando al cambio de modo del motor.
      return `
        <button class="tab-card mode-tab" data-modo="${m}" data-tab="${m}" role="tab" aria-selected="${selected}">
          <span class="tab-number">${meta.numero}</span>
          <span class="tab-text">
            <span class="tab-name">${meta.nombre}</span>
            <span class="tab-sub">${meta.sub}</span>
          </span>
        </button>
      `
    }).join('')
  }

  private handleClick = (e: Event): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.tab-card')
    if (!target) return
    const modo = target.dataset.modo as Modo
    if (modo === this.actual) return
    this.activar(modo)
  }

  activar(modo: Modo): void {
    this.actual = modo
    this.bar.querySelectorAll<HTMLElement>('.tab-card').forEach(card => {
      card.setAttribute('aria-selected', card.dataset.modo === modo ? 'true' : 'false')
    })
    document.querySelectorAll<HTMLElement>('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${modo}`)
    })
    this.onChange?.(modo)
  }

  onModoChange(cb: (modo: Modo) => void): void {
    this.onChange = cb
  }

  get modo(): Modo { return this.actual }
}
