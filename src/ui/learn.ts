const ALFABETO: string[] = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N',
  'Ñ','O','P','Q','R','S','T','U','V','W','X','Y','Z',
]

export class AlphabetLearn {
  private celdas: HTMLElement[] = []
  private vistas = new Set<string>()
  private actual: string | null = null

  constructor() {
    this.render()
  }

  private render(): void {
    const panel = document.getElementById('tab-aprendizaje')
    if (!panel) return
    panel.innerHTML = `
      <p class="alphabet-header">Alfabeto LSC · 28 letras</p>
      <div class="alphabet-grid" id="alphabet-grid" role="list">
        ${ALFABETO.map(l => `
          <span class="alphabet-cell" data-letter="${l}" role="listitem" aria-label="Letra ${l}">
            ${l.toLowerCase()}
          </span>
        `).join('')}
      </div>
    `
    this.celdas = Array.from(panel.querySelectorAll<HTMLElement>('.alphabet-cell'))
  }

  resaltar(letra: string): void {
    const nueva = letra ? letra.toUpperCase() : null
    if (nueva === this.actual) return
    if (nueva) this.vistas.add(nueva)
    this.actual = nueva
    this.repaint()
  }

  limpiar(): void {
    if (this.actual === null) return
    this.actual = null
    this.repaint()
  }

  private repaint(): void {
    for (const cell of this.celdas) {
      const l = cell.dataset.letter!
      if (l === this.actual) {
        cell.dataset.state = 'active'
      } else if (this.vistas.has(l)) {
        cell.dataset.state = 'seen'
      } else {
        delete cell.dataset.state
      }
    }
  }
}
