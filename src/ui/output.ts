const STREAM_W   = 300
const STREAM_H   = 130
const STREAM_MAX = 150  // ~5s a 30fps

// Coordenadas X precalculadas: solo dependen del índice, no del valor.
const STREAM_XS: string[] = Array.from(
  { length: STREAM_MAX },
  (_, i) => ((i / (STREAM_MAX - 1)) * STREAM_W).toFixed(1)
)

export class OutputPanel {
  private letterEl:    HTMLElement | null = null
  private textEl:      HTMLElement | null = null
  private bufferCells: HTMLElement[] = []
  private bufferCount: HTMLElement | null = null
  private streamLine:  SVGPathElement | null = null
  private streamArea:  SVGPathElement | null = null
  private streamDot:   SVGCircleElement | null = null
  private streamAvg:   HTMLElement | null = null
  private letras: string[] = []
  private letraActual = '·'
  private letraTimer = 0
  private bufferPrev = 0
  private bufferHoldTimer = 0
  private streamBuf: number[] = []
  private streamSum = 0

  constructor() {
    const root = document.getElementById('tab-traductor')
    if (!root) return
    this.render(root)
    this.letterEl    = document.getElementById('prediction')
    this.textEl      = document.getElementById('final-text')
    this.bufferCells = Array.from(root.querySelectorAll<HTMLElement>('.buffer-block__cell'))
    this.bufferCount = root.querySelector('.buffer-block__count')
    this.streamLine  = document.getElementById('stream-line') as SVGPathElement | null
    this.streamArea  = document.getElementById('stream-area') as SVGPathElement | null
    this.streamDot   = document.getElementById('stream-dot')  as SVGCircleElement | null
    this.streamAvg   = document.getElementById('stream-avg')

    document.getElementById('btn-clear')?.addEventListener('click', () => this.limpiarTexto())
  }

  private render(root: HTMLElement): void {
    root.innerHTML = `
      <div class="detection">
        <div class="detection__letter">
          <span class="detection__label">letra detectada</span>
          <span class="detection__value" id="prediction" aria-live="polite">·</span>
          <span class="detection__sub">esperando seña…</span>
        </div>
        <div class="confidence-arc">
          <svg class="confidence-arc__svg" viewBox="0 0 100 100">
            <circle class="confidence-arc__track" cx="50" cy="50" r="42"/>
            <circle class="confidence-arc__fill" id="conf-arc-fill"
              cx="50" cy="50" r="42"
              stroke-dasharray="263.9"
              stroke-dashoffset="263.9"/>
          </svg>
          <div class="confidence-arc__center">
            <span class="confidence-arc__pct" id="m-conf">0<span class="unit">%</span></span>
          </div>
        </div>
      </div>

      <div class="buffer-block">
        <div class="buffer-block__head">
          <span class="buffer-block__label">buffer</span>
          <span class="buffer-block__count">00<span class="denom">/09</span></span>
        </div>
        <div class="buffer-block__bar">
          ${Array.from({ length: 9 }, () => '<span class="buffer-block__cell"></span>').join('')}
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="metric__label">lat</div>
          <div class="metric__value" id="m-time">·<span class="unit">ms</span></div>
        </div>
        <div class="metric">
          <div class="metric__label">fps</div>
          <div class="metric__value" id="m-fps">·</div>
        </div>
        <div class="metric">
          <div class="metric__label">mano</div>
          <div class="metric__value" id="m-hand" data-state="off">ND</div>
        </div>
        <div class="metric">
          <div class="metric__label">estado</div>
          <div class="metric__value metric__value--sm" id="m-estado" data-state="off">·</div>
        </div>
      </div>

      <div class="stream">
        <div class="stream__head">
          <span class="stream__label">confianza · tendencia</span>
          <span class="stream__avg" id="stream-avg">avg --<span class="unit">%</span></span>
        </div>
        <div class="stream__plot">
          <div class="stream__y-axis">
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
          <div class="stream__chart">
            <svg viewBox="0 0 ${STREAM_W} ${STREAM_H}" preserveAspectRatio="none">
              <defs>
                <linearGradient id="streamGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="oklch(0.74 0.14 195)" stop-opacity="0.45"/>
                  <stop offset="100%" stop-color="oklch(0.74 0.14 195)" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <line class="stream__grid" x1="0" y1="0"            x2="${STREAM_W}" y2="0"/>
              <line class="stream__grid" x1="0" y1="${STREAM_H/2}" x2="${STREAM_W}" y2="${STREAM_H/2}"/>
              <line class="stream__grid" x1="0" y1="${STREAM_H}"   x2="${STREAM_W}" y2="${STREAM_H}"/>
              <line class="stream__threshold-line" x1="0" y1="23.4" x2="${STREAM_W}" y2="23.4"/>
              <text class="stream__threshold-label" x="${STREAM_W - 4}" y="19" text-anchor="end">umbral 82</text>
              <path class="stream__area" id="stream-area" d=""/>
              <path class="stream__line" id="stream-line" d=""/>
              <circle class="stream__dot" id="stream-dot" cx="${STREAM_W}" cy="${STREAM_H}" r="3"/>
            </svg>
          </div>
        </div>
        <div class="stream__x-axis">
          <span></span>
          <div class="stream__x-axis-inner">
            <span>anterior</span>
            <span></span>
            <span>ahora</span>
          </div>
        </div>
      </div>
    `
  }

  setLetra(letra: string): void {
    if (!this.letterEl) return
    const display = letra || '·'
    if (display === this.letraActual) return
    this.letraActual = display
    clearTimeout(this.letraTimer)
    this.letterEl.dataset.changing = 'true'
    const el = this.letterEl
    this.letraTimer = window.setTimeout(() => {
      el.textContent = display
      el.dataset.changing = 'false'
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
    this.renderText()
  }

  private renderText(): void {
    if (!this.textEl) return
    const completo = this.letras.join('')
    if (!completo) {
      this.textEl.innerHTML = '<span class="transcript__caret"></span>'
      return
    }
    this.textEl.innerHTML = this.escape(completo) + '<span class="transcript__caret"></span>'
  }

  setBuffer(activos: number, total = 9): void {
    if (this.bufferCells.length === 0 || !this.bufferCount) return
    if (activos < this.bufferPrev) {
      clearTimeout(this.bufferHoldTimer)
      this.bufferHoldTimer = window.setTimeout(() => {
        this.applyBuffer(0, total)
        this.bufferPrev = 0
      }, 420)
      return
    }
    clearTimeout(this.bufferHoldTimer)
    if (activos === this.bufferPrev) return
    this.bufferPrev = activos
    this.applyBuffer(activos, total)
  }

  private applyBuffer(activos: number, total: number): void {
    if (!this.bufferCount) return
    this.bufferCells.forEach((c, i) => {
      if (i < activos - 1) {
        c.dataset.on = 'true'
      } else if (i === activos - 1 && activos > 0) {
        c.dataset.on = 'partial'
      } else {
        c.removeAttribute('data-on')
      }
    })
    this.bufferCount.innerHTML = `${String(activos).padStart(2, '0')}<span class="denom">/${total}</span>`
  }

  actualizarStream(confianza: number): void {
    this.streamBuf.push(confianza)
    this.streamSum += confianza
    if (this.streamBuf.length > STREAM_MAX) {
      this.streamSum -= this.streamBuf.shift()!
    }
    this.renderStream()
  }

  private renderStream(): void {
    const buf = this.streamBuf
    const n = buf.length
    if (n < 2 || !this.streamLine || !this.streamArea || !this.streamDot) return

    let d = 'M'
    for (let i = 0; i < n; i++) {
      if (i > 0) d += 'L'
      d += STREAM_XS[i] + ',' + (STREAM_H * (1 - buf[i])).toFixed(1)
    }

    const xLast = STREAM_XS[n - 1]
    const yLast = (STREAM_H * (1 - buf[n - 1])).toFixed(1)

    this.streamLine.setAttribute('d', d)
    this.streamArea.setAttribute('d', `${d}L${xLast},${STREAM_H}L0,${STREAM_H}Z`)
    this.streamDot.setAttribute('cx', xLast)
    this.streamDot.setAttribute('cy', yLast)

    if (this.streamAvg) {
      this.streamAvg.innerHTML = `avg ${Math.round((this.streamSum / n) * 100)}<span class="unit">%</span>`
    }
  }

  private escape(s: string): string {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  }
}
