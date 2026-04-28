// ============================================================================
// GAME.TS — Gamificación YOSO · Palabras en español via Datamuse
// ============================================================================

const NIVELES = [
  { nivel: 1, minLen: 3, maxLen: 4, req: 3,  label: 'NOVATO'   },
  { nivel: 2, minLen: 4, maxLen: 5, req: 5,  label: 'BASICO'   },
  { nivel: 3, minLen: 5, maxLen: 6, req: 7,  label: 'MEDIO'    },
  { nivel: 4, minLen: 6, maxLen: 7, req: 9,  label: 'AVANZADO' },
  { nivel: 5, minLen: 7, maxLen: 9, req: 12, label: 'MAESTRO'  },
]

export class GameManager {
  private readonly elObjetivo:    HTMLElement
  private readonly elFeedback:    HTMLElement
  private readonly elPuntuacion:  HTMLElement
  private readonly elNivel:       HTMLElement
  private readonly elProgreso:    HTMLElement
  private readonly elProgresoBar: HTMLElement
  private readonly elImagenPista: HTMLImageElement

  private nivelIdx:     number   = 0
  private puntos:       number   = 0
  private palabraActual:string   = ''
  private letraIdx:     number   = 0
  private palabrasOk:   number   = 0
  private errores:      number   = 0   // errores en la letra actual
  private bloqueado:    boolean  = false
  private activo:       boolean  = false
  private timerPista:   number   = 0
  private pool:         string[] = []

  constructor() {
    this.elObjetivo    = document.getElementById('letra-objetivo')!
    this.elFeedback    = document.getElementById('feedback-mensaje')!
    this.elPuntuacion  = document.getElementById('puntuacion')!
    this.elNivel       = document.getElementById('nivel-label')!
    this.elProgreso    = document.getElementById('progreso-texto')!
    this.elProgresoBar = document.getElementById('progreso-bar')!
    this.elImagenPista = document.getElementById('imagen-pista') as HTMLImageElement
  }

  public async activar(): Promise<void> {
    this.activo     = true
    this.nivelIdx   = 0
    this.puntos     = 0
    this.palabrasOk = 0
    this.elPuntuacion.innerText = '0'
    this._setFeedback('CARGANDO...', 'idle')
    await this._cargarPool()
    this._nuevaPalabra()
  }

  public desactivar(): void {
    this.activo = false
    clearTimeout(this.timerPista)
    this.elImagenPista.classList.remove('visible')
  }

  public onLetraConfirmada(letra: string): void {
    if (!this.activo || this.bloqueado) return
    if (letra === ' ' || letra === '\u232b') return
    letra === this.palabraActual[this.letraIdx]
      ? this._letraCorrecta()
      : this._letraIncorrecta(letra)
  }

  // ── Privados ──────────────────────────────────────────────────────────────

  private async _cargarPool(): Promise<void> {
    const { minLen, maxLen } = NIVELES[this.nivelIdx]
    try {
      const url = `https://api.datamuse.com/words?sp=${'?'.repeat(minLen)}&v=es&max=200`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { word: string }[] = await res.json()

      const filtradas = data
        .map(d => d.word.toUpperCase())
        .filter(w =>
          w.length >= minLen &&
          w.length <= maxLen &&
          /^[A-Z]+$/.test(w)
        )
        .sort(() => Math.random() - 0.5)

      if (filtradas.length < 5) throw new Error('Pool insuficiente')
      this.pool = filtradas

    } catch (err) {
      console.warn('[GameManager] Datamuse falló, usando banco local:', err)
      // Banco de respaldo por nivel — solo letras A-Z sin tildes
      const BANCO: Record<number, string[]> = {
        1: ['SOL','MAR','PAZ','LUZ','RED','PAN','CAL','FIN','GAS','VAL'],
        2: ['CASA','VIDA','MANO','AGUA','GATO','LUNA','PASO','MESA','FARO','ISLA'],
        3: ['CAMPO','FUEGO','MUNDO','PLAYA','LIBRO','SUELO','TIGRE','NORTE','VAPOR','ARENA'],
        4: ['CIUDAD','PUENTE','CAMINO','FRENTE','BOSQUE','CENTRO','MARINA','LATIDO','ORIGEN','PALOMA'],
        5: ['SISTEMA','PROCESO','CONTROL','CIENCIA','BALANCE','TABLERO','USUARIO','VENTANA','RECURSO','PALABRA'],
      }
      const nivel = this.nivelIdx + 1
      this.pool = [...(BANCO[nivel] ?? BANCO[1])].sort(() => Math.random() - 0.5)
      this._setFeedback('SIN CONEXIÓN — MODO LOCAL', 'warn')
      window.setTimeout(() => {
        if (this.activo && !this.bloqueado) this._setFeedback('FIRMANDO...', 'idle')
      }, 2000)
    }
  }

  private _nuevaPalabra(): void {
    clearTimeout(this.timerPista)
    this.elImagenPista.classList.remove('visible')
    this.bloqueado = false
    this.letraIdx  = 0
    this.elNivel.innerText = NIVELES[this.nivelIdx].label

    if (this.pool.length === 0) {
      this._cargarPool().then(() => this._nuevaPalabra())
      return
    }

    this.palabraActual = this.pool.pop()!
    this.errores = 0
    this._renderPalabra()
    this._renderProgreso()
    this._setFeedback('FIRMANDO...', 'idle')

    this.timerPista = window.setTimeout(() => {
      if (this.activo && !this.bloqueado) {
        this.elImagenPista.classList.add('visible')
        this._setFeedback('OBSERVA LA GUIA', 'warn')
      }
    }, 6000)
  }

  private _letraCorrecta(): void {
    this.errores = 0
    this.letraIdx++
    this._renderPalabra()

    if (this.letraIdx >= this.palabraActual.length) {
      this.bloqueado   = true
      this.puntos     += this.palabraActual.length * 10
      this.palabrasOk++
      this.elPuntuacion.innerText = String(this.puntos)
      this.elPuntuacion.classList.remove('score-bump')
      void this.elPuntuacion.offsetWidth
      this.elPuntuacion.classList.add('score-bump')
      clearTimeout(this.timerPista)
      this.elImagenPista.classList.remove('visible')

      const nivel = NIVELES[this.nivelIdx]
      if (this.palabrasOk >= nivel.req && this.nivelIdx < NIVELES.length - 1) {
        this.nivelIdx++
        this.palabrasOk = 0
        this._setFeedback(`NIVEL: ${NIVELES[this.nivelIdx].label}`, 'success')
        this._cargarPool().then(() => {
          window.setTimeout(() => { if (this.activo) this._nuevaPalabra() }, 1600)
        })
      } else {
        this._setFeedback('PALABRA COMPLETA', 'success')
        this._renderProgreso()
        window.setTimeout(() => { if (this.activo) this._nuevaPalabra() }, 1400)
      }
    } else {
      this._setFeedback('CORRECTO', 'success')
      window.setTimeout(() => {
        if (this.activo && !this.bloqueado) this._setFeedback('FIRMANDO...', 'idle')
      }, 500)
    }
  }

  private _letraIncorrecta(letra: string): void {
    this.errores++

    if (this.errores >= 3) {
      // 3 errores en la misma letra — saltar palabra
      this.errores  = 0
      this.bloqueado = true
      clearTimeout(this.timerPista)
      this.elImagenPista.classList.remove('visible')
      this._setFeedback('PALABRA SALTADA', 'warn')
      window.setTimeout(() => { if (this.activo) this._nuevaPalabra() }, 1200)
      return
    }

    this._setFeedback(`"${letra}" - NECESITAS "${this.palabraActual[this.letraIdx]}" · ${3 - this.errores} intentos`, 'error')
    window.setTimeout(() => {
      if (this.activo && !this.bloqueado) this._setFeedback('FIRMANDO...', 'idle')
    }, 900)
  }

  private _renderPalabra(): void {
    // Fix XSS: createElement en vez de innerHTML — palabraActual viene de API externa
    this.elObjetivo.textContent = ''
    this.palabraActual.split('').forEach((ch, i) => {
      const span = document.createElement('span')
      span.textContent = ch   // textContent escapa automáticamente
      span.className   = i < this.letraIdx   ? 'gw-done'
                       : i === this.letraIdx ? 'gw-current'
                       :                       'gw-pending'
      this.elObjetivo.appendChild(span)
    })
  }

  private _renderProgreso(): void {
    const { req } = NIVELES[this.nivelIdx]
    const pct = Math.round((this.palabrasOk / req) * 100)
    this.elProgreso.innerText      = `${this.palabrasOk}/${req}`
    this.elProgresoBar.style.width = `${pct}%`
  }

  private _setFeedback(msg: string, type: 'idle' | 'success' | 'error' | 'warn'): void {
    this.elFeedback.textContent = msg
    this.elFeedback.className   = `game-feedback fb-${type}`
  }
}