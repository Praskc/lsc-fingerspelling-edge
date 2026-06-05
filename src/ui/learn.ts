// ============================================================================
// LEARN · Grid 5×6 del alfabeto LSC
// Mantiene API: resaltar(letra), limpiar()
// Acumula clases vistas en la sesión para que las celdas conserven estado "seen".
// ============================================================================

const ALFABETO: string[] = [
  'A','B','C','D','E','F',
  'G','H','I','J','K','L',
  'M','N','Ñ','O','P','Q',
  'R','S','T','U','V','W',
  'X','Y','Z',
]

export class AlphabetLearn {
  private root: HTMLElement | null = null
  private vistas = new Set<string>()
  private actual: string | null = null

  constructor() {
    queueMicrotask(() => this.render())
  }

  private render(): void {
    const panel = document.getElementById('tab-aprendizaje')
    if (!panel) return
    panel.innerHTML = `
      <section class="output-section">
        <p class="output-eyebrow">→ EXPLORA EL ALFABETO LSC</p>
        <div class="output-body">
          <div class="output-letter" id="learn-letter">_</div>
          <div class="output-text-block">
            <p class="output-label">ALFABETO</p>
            <div class="alphabet-grid" id="alphabet-grid">
              ${ALFABETO.map(l => `<span class="alphabet-cell" data-letter="${l}">${l.toLowerCase()}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="signature">
          <div class="signature__author">
            <span class="signature__eyebrow">DEVELOPED BY</span>
            <span class="signature__name">Esteban Cotera</span>
          </div>
          <a class="signature__link" href="https://github.com/Praskc" target="_blank" rel="noopener">@Praskc ↗</a>
        </div>
      </section>
    `
    this.root = document.getElementById('alphabet-grid')
  }

  resaltar(letra: string): void {
    if (!this.root) return
    if (letra) this.vistas.add(letra.toUpperCase())
    this.actual = letra ? letra.toUpperCase() : null
    this.repaint()
    const learnLetter = document.getElementById('learn-letter')
    if (learnLetter) learnLetter.textContent = letra || '_'
  }

  limpiar(): void {
    this.actual = null
    this.repaint()
    const learnLetter = document.getElementById('learn-letter')
    if (learnLetter) learnLetter.textContent = '_'
  }

  private repaint(): void {
    if (!this.root) return
    this.root.querySelectorAll<HTMLElement>('.alphabet-cell').forEach(cell => {
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
