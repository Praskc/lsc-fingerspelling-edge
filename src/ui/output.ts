// ============================================================================
// OUTPUT · Renderiza el panel de salida del modo Traductor.
// Drop-cap de letra detectada, texto completo, underline cromático,
// buffer de votación y firma editorial Esteban Cotera.
// ============================================================================

export class OutputPanel {
  private root: HTMLElement | null
  private letterEl: HTMLElement | null = null
  private textEl: HTMLElement | null = null
  private bufferBar: HTMLElement | null = null
  private bufferCount: HTMLElement | null = null
  private letras: string[] = []
  private palabraActual = ''
  private letraActual = '_'

  constructor() {
    this.root = document.getElementById('tab-traductor')
    if (!this.root) return
    this.render()
    this.letterEl    = this.root.querySelector('.output-letter')
    this.textEl      = this.root.querySelector('.output-text')
    this.bufferBar   = this.root.querySelector('.buffer__bar')
    this.bufferCount = this.root.querySelector('.buffer__count')
  }

  private render(): void {
    if (!this.root) return
    this.root.innerHTML = `
      <section class="output-section">
        <p class="output-eyebrow">→ DETECTANDO</p>

        <div class="output-body">
          <div class="output-letter" id="prediction" aria-live="polite">_</div>
          <div class="output-text-block">
            <p class="output-label">TEXTO</p>
            <p class="output-text" id="final-text" aria-live="polite"><span class="caret">|</span></p>
          </div>
        </div>

        <div class="buffer">
          <div class="buffer__head">
            <span class="buffer__label">BUFFER DE VOTACIÓN</span>
            <span class="buffer__count">00<span class="denom">/09</span></span>
          </div>
          <div class="buffer__bar">
            ${Array.from({ length: 9 }, () => '<span class="buffer__block"></span>').join('')}
          </div>
        </div>

        <div class="signature">
          <div class="signature__author">
            <span class="signature__eyebrow">DEVELOPED BY</span>
            <span class="signature__name">Esteban Cotera</span>
          </div>
          <a class="signature__link" href="https://github.com/Praskc" target="_blank" rel="noopener" aria-label="GitHub Praskc">@Praskc ↗</a>
        </div>
      </section>
    `
  }

  setLetra(letra: string): void {
    if (!this.letterEl) return
    if (letra === this.letraActual) return
    this.letterEl.dataset.changing = 'true'
    const el = this.letterEl
    setTimeout(() => {
      el.textContent = letra || '_'
      el.dataset.changing = 'false'
      this.letraActual = letra
    }, 180)
  }

  agregarLetra(letra: string, borrar: boolean): void {
    if (borrar) {
      this.letras.pop()
    } else {
      this.letras.push(letra)
    }
    this.renderText()
  }

  limpiarTexto(): void {
    this.letras = []
    this.palabraActual = ''
    this.renderText()
  }

  private renderText(): void {
    if (!this.textEl) return
    const completo = this.letras.join('')
    const partes = completo.split(' ')
    const palabras = partes.map((p, i) => {
      const isLast = i === partes.length - 1
      return isLast ? this.escape(p) : `<span class="word">${this.escape(p)}</span>`
    })
    const ultima = partes[partes.length - 1] ?? ''
    const html = palabras.join(' ') + `<span class="caret">|</span>`
    this.textEl.innerHTML = html
    this.palabraActual = ultima
  }

  completarPalabra(): void {
    if (!this.textEl) return
    const words = this.textEl.querySelectorAll<HTMLElement>('.word')
    const last = words[words.length - 1]
    if (last) {
      last.classList.add('is-completing')
    }
  }

  setBuffer(activos: number, total = 9): void {
    if (!this.bufferBar || !this.bufferCount) return
    const blocks = this.bufferBar.querySelectorAll<HTMLElement>('.buffer__block')
    blocks.forEach((b, i) => {
      if (i < activos - 1) {
        b.dataset.filled = 'true'
      } else if (i === activos - 1 && activos > 0) {
        b.dataset.filled = 'partial'
      } else {
        b.dataset.filled = 'false'
      }
    })
    this.bufferCount.innerHTML = `${String(activos).padStart(2, '0')}<span class="denom">/${total}</span>`
  }

  private escape(s: string): string {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  }
}
