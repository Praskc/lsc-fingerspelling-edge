// ============================================================================
// LEARN · Modo Aprendizaje.
// Hero = letra detectada gigante. Debajo, tira horizontal con las 28 clases
// del alfabeto LSC; cada celda es un placeholder vacío reservado para una
// ilustración futura del diseñador gráfico.
// Mantiene API: resaltar(letra), limpiar().
// ============================================================================

const ALFABETO: string[] = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N',
  'Ñ','O','P','Q','R','S','T','U','V','W','X','Y','Z',
]

export class AlphabetLearn {
  private gridEl: HTMLElement | null = null
  private heroEl: HTMLElement | null = null
  private vistas = new Set<string>()
  private actual: string | null = null

  constructor() {
    this.render()
  }

  private render(): void {
    const panel = document.getElementById('tab-aprendizaje')
    if (!panel) return
    panel.innerHTML = `
      <section class="learn-section">
        <header class="learn-head">
          <span class="learn-eyebrow">SEÑA DETECTADA</span>
          <span class="learn-meta">28 LETRAS LSC</span>
        </header>

        <div class="learn-hero-wrap">
          <div id="learn-hero" class="learn-hero">·</div>
        </div>

        <div class="learn-strip" id="alphabet-grid" role="list">
          ${ALFABETO.map(l => `
            <span class="learn-cell" data-letter="${l}" role="listitem" aria-label="Letra ${l}">
              <span class="learn-cell__label">${l.toLowerCase()}</span>
              <span class="learn-cell__placeholder" aria-hidden="true"></span>
            </span>
          `).join('')}
        </div>
      </section>
    `
    this.gridEl = document.getElementById('alphabet-grid')
    this.heroEl = document.getElementById('learn-hero')
  }

  resaltar(letra: string): void {
    if (!this.gridEl) return
    if (letra) this.vistas.add(letra.toUpperCase())
    this.actual = letra ? letra.toUpperCase() : null
    this.repaint()
    if (this.heroEl) this.heroEl.textContent = letra || '·'
  }

  limpiar(): void {
    this.actual = null
    this.repaint()
    if (this.heroEl) this.heroEl.textContent = '·'
  }

  private repaint(): void {
    if (!this.gridEl) return
    this.gridEl.querySelectorAll<HTMLElement>('.learn-cell').forEach(cell => {
      const l = cell.dataset.letter!
      if (l === this.actual) {
        cell.dataset.state = 'active'
      } else if (this.vistas.has(l)) {
        cell.dataset.state = 'seen'
      } else {
        delete cell.dataset.state
      }
    })
  }
}
