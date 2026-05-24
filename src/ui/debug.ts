import type { CargaDebug } from '../engine/types'

export class DebugPanel {
  private readonly dbRojo:     HTMLElement
  private readonly dbBarRojo:  HTMLElement
  private readonly dbEfectivo: HTMLElement
  private readonly dbBarEfect: HTMLElement
  private readonly dbDist:     HTMLElement
  private readonly dbBarDist:  HTMLElement
  private readonly dbDistRef:  HTMLElement
  private readonly dbVotos:    HTMLElement
  private readonly dbBuffer:   HTMLElement
  private readonly dbTop3:     HTMLElement
  private readonly dbMem:      HTMLElement
  private readonly dbBarMem:   HTMLElement
  private readonly dbMp:       HTMLElement
  private readonly dbBarMp:    HTMLElement
  private readonly dbFps:      HTMLElement

  constructor() {
    this.dbRojo     = document.getElementById('db-red')!
    this.dbBarRojo  = document.getElementById('db-bar-red')!
    this.dbEfectivo = document.getElementById('db-eff')!
    this.dbBarEfect = document.getElementById('db-bar-eff')!
    this.dbDist     = document.getElementById('db-dist')!
    this.dbBarDist  = document.getElementById('db-bar-dist')!
    this.dbDistRef  = document.getElementById('db-distref')!
    this.dbVotos    = document.getElementById('db-votes')!
    this.dbBuffer   = document.getElementById('db-buffer')!
    this.dbTop3     = document.getElementById('db-top3')!
    this.dbMem      = document.getElementById('db-mem')!
    this.dbBarMem   = document.getElementById('db-bar-mem')!
    this.dbMp       = document.getElementById('db-mp')!
    this.dbBarMp    = document.getElementById('db-bar-mp')!
    this.dbFps      = document.getElementById('db-fps')!
    this._vincular()
  }

  actualizar(p: CargaDebug): void {
    const pRojo = (p.probRed      * 100).toFixed(1)
    const pEfec = (p.confEfectiva * 100).toFixed(1)

    this.dbRojo.textContent     = pRojo + '%'
    this.dbEfectivo.textContent = pEfec + '%'
    this.dbBarRojo.style.width  = pRojo + '%'
    this.dbBarEfect.style.width = pEfec + '%'
    this.dbBarEfect.classList.toggle('below-threshold', p.confEfectiva < 0.82)

    if (p.distancia !== null && p.distRef !== null) {
      const pct = Math.min((p.distancia / (p.distRef * 2)) * 100, 100).toFixed(0)
      this.dbDist.textContent    = p.distancia.toFixed(3) + ' / ' + p.distRef.toFixed(3)
      this.dbBarDist.style.width = pct + '%'
      this.dbBarDist.classList.toggle('high-dist', p.distancia > p.distRef * 1.5)
      this.dbDistRef.textContent = 'P75=' + p.distRef.toFixed(3)
    } else {
      this.dbDist.textContent    = '—'
      this.dbBarDist.style.width = '0%'
      this.dbDistRef.textContent = '—'
    }

    const ganador = this._ganador(p.bufferActual)
    this.dbBuffer.textContent = ''
    Array(9).fill('').map((_, i) => p.bufferActual[i] ?? '').forEach(ch => {
      const celda = document.createElement('span')
      celda.className = 'vote-cell ' + (
        ch === ''      ? 'vote-empty' :
        ch === '-'     ? 'vote-miss'  :
        ch === ganador ? 'vote-hit vote-winner' : 'vote-hit'
      )
      celda.textContent = ch === '' ? '·' : ch === '-' ? '✗' : ch
      this.dbBuffer.appendChild(celda)
    })
    this.dbVotos.textContent = ganador
      ? `${ganador}: ${p.bufferActual.filter(x => x === ganador).length}/9`
      : '—'

    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    if (mem) {
      const usedMB  = (mem.usedJSHeapSize  / 1048576).toFixed(0)
      const limitMB = mem.jsHeapSizeLimit   / 1048576
      const pct     = Math.min((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100, 100).toFixed(0)
      this.dbMem.textContent    = usedMB + ' MB'
      this.dbBarMem.style.width = pct + '%'
      this.dbBarMem.style.background = mem.usedJSHeapSize > limitMB * 0.7 * 1048576
        ? 'var(--red)' : 'var(--green)'
    } else {
      this.dbMem.textContent    = 'N/A'
      this.dbBarMem.style.width = '0%'
    }

    this.dbTop3.textContent = ''
    p.topN.forEach((item, idx) => {
      const contenedor = document.createElement('span')
      contenedor.className = `top3-item${idx === 0 ? ' t3-winner' : ''}`
      const elLetra = document.createElement('span')
      elLetra.className   = 't3-letter'
      elLetra.textContent = item.letra
      const elProb = document.createElement('span')
      elProb.className   = 't3-prob'
      elProb.textContent = (item.prob * 100).toFixed(1) + '%'
      contenedor.appendChild(elLetra)
      contenedor.appendChild(document.createTextNode(' '))
      contenedor.appendChild(elProb)
      this.dbTop3.appendChild(contenedor)
    })
  }

  actualizarPerf(mpMs: number, fps: number): void {
    const slow     = mpMs > 50
    const verySlow = mpMs > 100
    this.dbMp.textContent    = mpMs.toFixed(0) + ' ms'
    this.dbBarMp.style.width = Math.min((mpMs / 200) * 100, 100) + '%'
    this.dbBarMp.className   = 'db db-mp' + (verySlow ? ' very-slow' : slow ? ' slow' : '')
    this.dbFps.textContent   = fps.toFixed(1) + ' fps'
  }

  private _vincular(): void {
    const checkbox = document.getElementById('debug-checkbox') as HTMLInputElement | null
    const panel    = document.getElementById('debug-panel')
    if (checkbox && panel) {
      checkbox.addEventListener('change', () => {
        panel.style.display = checkbox.checked ? 'block' : 'none'
      })
    }
  }

  private _ganador(buffer: string[]): string {
    if (!buffer.length) return ''
    const conteo: Record<string, number> = {}
    let ganador = '', maximo = 0
    for (const ch of buffer) {
      conteo[ch] = (conteo[ch] ?? 0) + 1
      if (conteo[ch] > maximo) { maximo = conteo[ch]; ganador = ch }
    }
    return ganador
  }
}
