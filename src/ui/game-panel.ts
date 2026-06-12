// ============================================================================
// GAME PANEL · Sidebar del modo Entrenamiento.
// Preserva IDs requeridos por GameManager:
//   #letra-objetivo, #feedback-mensaje, #puntuacion, #nivel-label,
//   #progreso-texto, #progreso-bar, #imagen-pista
// ============================================================================

const NIVELES_META = [
  { label: 'NOVATO',   idx: 0 },
  { label: 'BÁSICO',   idx: 1 },
  { label: 'MEDIO',    idx: 2 },
  { label: 'AVANZADO', idx: 3 },
  { label: 'MAESTRO',  idx: 4 },
]

// Posiciones X de los nodos en el SVG (viewBox 0 0 340 80)
const NX = [34, 102, 170, 238, 306]
const NY = 40

export class GamePanel {
  private historyList:      HTMLElement | null = null
  private palabrasHistorial: string[] = []
  private nivelActual = 0

  constructor() {
    this.render()
  }

  private render(): void {
    const panel = document.getElementById('tab-entrenamiento')
    if (!panel) return
    panel.innerHTML = `
      <div class="game-stats">
        <div class="game-stat">
          <div class="game-stat__label">nivel</div>
          <div class="game-stat__value" id="nivel-label">NOVATO</div>
        </div>
        <div class="game-stat">
          <div class="game-stat__label">puntos</div>
          <div class="game-stat__value" id="puntuacion">0</div>
        </div>
        <div class="game-stat">
          <div class="game-stat__label">racha</div>
          <div class="game-stat__value" id="racha-valor">0</div>
        </div>
      </div>

      <div class="word-card">
        <div class="word-card__head">
          <span class="word-card__label">deletrea</span>
          <span class="word-card__source">
            <span class="word-card__source-icon">ai</span>
            banco local
          </span>
        </div>

        <div class="word" id="letra-objetivo" aria-live="polite"></div>

        <div class="attempts">
          <span class="attempts__label">intentos</span>
          <span class="attempts__dots">
            <span class="attempts__dot"></span>
            <span class="attempts__dot"></span>
            <span class="attempts__dot"></span>
          </span>
          <span class="attempts__hint">3 max</span>
        </div>

        <div class="word-card__progress">
          <div class="word-card__progress-label">
            <span>progreso del nivel</span>
            <span class="word-card__progress-count" id="progreso-texto">
              0<span class="denom">/10</span>
            </span>
          </div>
          <div class="word-card__progress-bar">
            <div class="word-card__progress-fill" id="progreso-bar"></div>
          </div>
        </div>
      </div>

      <img id="imagen-pista" hidden alt="" aria-hidden="true" style="display:none!important"/>

      <div class="game-feedback fb-idle" id="feedback-mensaje" role="status">haz la seña…</div>

      <div class="levels" id="levels-block">
        <div class="levels__head">
          <span class="levels__label">progresión</span>
          <span class="levels__sub" id="levels-sub">nivel 1 / 5</span>
        </div>
        <div class="levels__map">
          <svg class="levels__svg" id="levels-svg" viewBox="0 0 340 80" preserveAspectRatio="xMidYMid meet">
            ${this.buildConstellation(0)}
          </svg>
        </div>
      </div>

      <div class="history">
        <div class="history__head">
          <span class="history__label">palabras de la sesión</span>
          <span class="history__count" id="history-count">0</span>
        </div>
        <div class="history__list" id="history-list"></div>
      </div>
    `

    this.historyList = document.getElementById('history-list')
    this.vincularEventos()
  }

  private buildConstellation(nivelIdx: number): string {
    let svg = ''

    // Líneas de conexión
    for (let i = 0; i < NX.length - 1; i++) {
      const done = i < nivelIdx
      svg += `<line id="lvl-line-${i}"
        class="lvl-line${done ? ' lvl-line--done' : ''}"
        x1="${NX[i]}" y1="${NY}" x2="${NX[i+1]}" y2="${NY}"/>`
    }

    // Nodos y labels
    for (let i = 0; i < NX.length; i++) {
      const done    = i < nivelIdx
      const current = i === nivelIdx
      const nodeClass = done ? 'lvl-node--done' : current ? 'lvl-node--current' : 'lvl-node--locked'
      const labelClass = done ? 'lvl-label' : current ? 'lvl-label--current' : 'lvl-label--locked'

      if (current) {
        svg += `<circle id="lvl-glow-${i}" class="lvl-node--current-glow" cx="${NX[i]}" cy="${NY}" r="18"/>`
      }
      svg += `<circle id="lvl-node-${i}" class="lvl-node ${nodeClass}" cx="${NX[i]}" cy="${NY}" r="10"/>`
      svg += `<text id="lvl-lbl-${i}" class="lvl-label ${labelClass}" x="${NX[i]}" y="${NY + 26}">${NIVELES_META[i].label.toLowerCase()}</text>`
    }

    return svg
  }

  private vincularEventos(): void {
    window.addEventListener('yoso:juego', (e) => {
      const d = (e as CustomEvent<Record<string, unknown>>).detail
      switch (d.tipo) {
        case 'nivel':
          if (typeof d.nivelIdx === 'number' && d.nivelIdx !== this.nivelActual) {
            this.nivelActual = d.nivelIdx
            this.actualizarConstelacion(d.nivelIdx)
          }
          break
        case 'palabra':
          if (typeof d.palabra === 'string') this.agregarPalabraHistorial(d.palabra)
          if (typeof d.racha === 'number') this.setRacha(d.racha)
          break
        case 'omitida':
          this.setRacha(0)
          break
        case 'intentos':
          if (typeof d.errores === 'number') this.setIntentos(d.errores)
          break
        case 'fuente':
          this.setFuente(d.fuente === 'datamuse' ? 'datamuse' : 'banco local')
          break
      }
    })
  }

  private actualizarConstelacion(nivelIdx: number): void {
    const svg = document.getElementById('levels-svg')
    if (!svg) return
    svg.innerHTML = this.buildConstellation(nivelIdx)

    const sub = document.getElementById('levels-sub')
    if (sub) sub.textContent = `nivel ${nivelIdx + 1} / 5`
  }

  private agregarPalabraHistorial(palabra: string): void {
    this.palabrasHistorial.push(palabra)
    if (!this.historyList) return

    const countEl = document.getElementById('history-count')
    if (countEl) countEl.textContent = String(this.palabrasHistorial.length)

    const prev = this.historyList.querySelector('.history__word--latest')
    if (prev) prev.classList.remove('history__word--latest')

    const span = document.createElement('span')
    span.className = 'history__word history__word--latest'
    span.textContent = palabra.toLowerCase()
    this.historyList.appendChild(span)
  }

  private setRacha(racha: number): void {
    const el = document.getElementById('racha-valor')
    if (el) el.textContent = String(racha)
  }

  private setIntentos(errores: number): void {
    const dots = document.querySelectorAll<HTMLElement>('.attempts__dot')
    dots.forEach((dot, i) => dot.classList.toggle('attempts__dot--used', i < errores))
  }

  private setFuente(fuente: string): void {
    const el = document.querySelector('.word-card__source')
    if (el) {
      const icon = fuente === 'datamuse' ? 'api' : 'ai'
      el.innerHTML = `<span class="word-card__source-icon">${icon}</span>${fuente}`
    }
  }
}
