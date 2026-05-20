// ============================================================================
// UI.TS — Capa de renderizado DOM (sin lógica de negocio)
// ============================================================================
import { signURI }           from './signs'
import type { CargaDebug }   from './types'

export class RenderizadorUI {
  // ── HUD / predicción ──────────────────────────────────────────────────────
  private readonly elIndicadorListo: HTMLElement
  private readonly elEtiquetaListo:  HTMLElement
  private readonly elPrediccion:     HTMLElement
  private readonly elConfianza:      HTMLElement
  private readonly elMetricaTiempo:  HTMLElement
  private readonly elMetricaMano:    HTMLElement
  private readonly elMetricaEstado:  HTMLElement

  // ── Traductor ─────────────────────────────────────────────────────────────
  private readonly elTextoFinal:     HTMLElement

  // ── ROI ───────────────────────────────────────────────────────────────────
  private readonly elROI:            HTMLElement

  // ── Panel de depuración ───────────────────────────────────────────────────
  private readonly dbRojo:      HTMLElement
  private readonly dbBarRojo:   HTMLElement
  private readonly dbEfectivo:  HTMLElement
  private readonly dbBarEfect:  HTMLElement
  private readonly dbDist:      HTMLElement
  private readonly dbBarDist:   HTMLElement
  private readonly dbDistRef:   HTMLElement
  private readonly dbVotos:     HTMLElement
  private readonly dbBuffer:    HTMLElement
  private readonly dbTop3:      HTMLElement
  private readonly dbMem:       HTMLElement
  private readonly dbBarMem:    HTMLElement

  // ── Splash ────────────────────────────────────────────────────────────────
  private readonly elSplash:    HTMLElement
  private readonly elMsgSplash: HTMLElement

  // ── Aprendizaje ───────────────────────────────────────────────────────────
  private readonly elAlfabeto: HTMLElement
  private senaActiva = ''

  // ── Estado traductor ──────────────────────────────────────────────────────
  private textoAcumulado = ''

  // ── Empty state ───────────────────────────────────────────────────────────
  private readonly elEstadoVacio:  HTMLElement
  private readonly elEsTitulo:     HTMLElement
  private readonly elEsDesc:       HTMLElement
  private readonly elEsReintentar: HTMLElement

  // ── Toast ─────────────────────────────────────────────────────────────────
  private readonly elToastRoot:  HTMLElement
  private readonly _timersToast: Map<string, ReturnType<typeof setTimeout>> = new Map()

  // ── Onboarding ────────────────────────────────────────────────────────────
  private readonly elOnboarding: HTMLElement

  constructor() {
    this.elIndicadorListo = document.getElementById('ready-indicator')!
    this.elEtiquetaListo  = document.getElementById('ready-label')!
    this.elPrediccion     = document.querySelector('.prediction')!
    this.elConfianza      = document.querySelector('.confidence-val span')!
    this.elMetricaTiempo  = document.getElementById('m-time')!
    this.elMetricaMano    = document.getElementById('m-hand')!
    this.elMetricaEstado  = document.getElementById('m-status')!
    this.elTextoFinal     = document.getElementById('final_text')!
    this.elROI            = document.getElementById('roi-overlay')!
    this.dbRojo           = document.getElementById('db-red')!
    this.dbBarRojo        = document.getElementById('db-bar-red')!
    this.dbEfectivo       = document.getElementById('db-eff')!
    this.dbBarEfect       = document.getElementById('db-bar-eff')!
    this.dbDist           = document.getElementById('db-dist')!
    this.dbBarDist        = document.getElementById('db-bar-dist')!
    this.dbDistRef        = document.getElementById('db-distref')!
    this.dbVotos          = document.getElementById('db-votes')!
    this.dbBuffer         = document.getElementById('db-buffer')!
    this.dbTop3           = document.getElementById('db-top3')!
    this.dbMem            = document.getElementById('db-mem')!
    this.dbBarMem         = document.getElementById('db-bar-mem')!
    this.elSplash         = document.getElementById('splash-screen')!
    this.elMsgSplash      = document.getElementById('splash-msg')!
    this.elAlfabeto       = document.getElementById('alphabet-grid')!
    this.elEstadoVacio    = document.getElementById('empty-state')!
    this.elEsTitulo       = document.getElementById('es-title')!
    this.elEsDesc         = document.getElementById('es-desc')!
    this.elEsReintentar   = document.getElementById('es-retry')!
    this.elToastRoot      = document.getElementById('toast-root')!
    this.elOnboarding     = document.getElementById('onboarding')!

    this._construirAlfabeto()
    this._vincularDebug()
  }

  // ── Splash ────────────────────────────────────────────────────────────────
  mensajeSplash(mensaje: string, esError = false): void {
    const textos: Record<string, string> = {
      'Cargando modelo…':      'Preparando el motor de IA...',
      '✗ Error al cargar el modelo': 'No se pudo cargar el modelo',
    }
    this.elMsgSplash.textContent = textos[mensaje] ?? mensaje
    this.elMsgSplash.classList.toggle('splash-error', esError)
  }

  ocultarSplash(): void {
    this.elSplash.classList.add('splash-hidden')
  }

  ocultarSkeleton(): void {
    document.getElementById('canvas-skeleton')?.classList.add('skeleton-oculto')
  }

  // ── Indicador de listo ────────────────────────────────────────────────────
  estadoListo(estado: 'idle' | 'signing' | 'warning'): void {
    this.elIndicadorListo.className = `ready-indicator ${estado}`
    this.elEtiquetaListo.textContent = estado === 'signing' ? 'LEYENDO...'
                                     : estado === 'warning' ? 'FUERA DE ZONA'
                                     : 'LISTO PARA LEER'
  }

  // ── ROI ───────────────────────────────────────────────────────────────────
  actualizarROI(fueraZona: boolean): void {
    this.elROI.classList.toggle('roi-fuera',  fueraZona)
    this.elROI.classList.toggle('roi-activa', !fueraZona)
  }

  limpiarROI(): void {
    this.elROI.classList.remove('roi-fuera', 'roi-activa')
  }

  // ── Predicción / HUD ──────────────────────────────────────────────────────
  actualizarPrediccion(letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    this.elMetricaTiempo.textContent = latencia.toFixed(1) + ' ms'
    this.elMetricaMano.textContent   = esIzquierda ? 'DERECHA' : 'IZQUIERDA'
    if (letra !== '-') {
      this.elPrediccion.textContent = letra
      this.elConfianza.textContent  = (confianza * 100).toFixed(1) + '%'
    } else {
      this.elPrediccion.textContent = '_'
      this.elConfianza.textContent  = 'Buscando...'
    }
  }

  estadoMano(estado: string, esOptimo: boolean): void {
    this.elMetricaEstado.textContent = estado
    this.elMetricaEstado.className   = esOptimo ? 'hud-val status-ok' : 'hud-val status-warning'
  }

  limpiarMano(): void {
    this.elPrediccion.textContent    = '_'
    this.elConfianza.textContent     = '--'
    this.elMetricaMano.textContent   = 'ND'
    this.elMetricaTiempo.textContent = '-- ms'
    this.elMetricaEstado.textContent = 'Esperando'
    this.elMetricaEstado.className   = 'hud-val'
  }

  // ── Texto traducido ───────────────────────────────────────────────────────
  agregarLetra(letra: string, borrar: boolean): void {
    if (borrar) {
      this.textoAcumulado = this.textoAcumulado.slice(0, -1)
    } else {
      this.textoAcumulado += letra
    }
    this.elTextoFinal.textContent = this.textoAcumulado
    this._destelloConfirmado()
  }

  limpiarTexto(): void {
    this.textoAcumulado           = ''
    this.elTextoFinal.textContent = ''
  }

  // ── Empty state — error de cámara ─────────────────────────────────────────
  mostrarEstadoVacio(err: DOMException | null, onReintentar: () => void, bloqueado = false): void {
    const esMobil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    const mensajes: Record<string, [string, string]> = {
      NotAllowedError: bloqueado ? [
        'Cámara bloqueada',
        esMobil
          ? 'Toca el candado junto a la URL, entra a Permisos del sitio > Cámara > Permitir, y recarga.'
          : 'Haz clic en el candado de la barra de dirección, entra a Permisos del sitio > Cámara > Permitir.'
      ] : [
        'Se necesita acceso a la cámara',
        'Pulsa "Permitir" cuando el navegador lo solicite para que YOSO pueda detectar tus señas.'
      ],
      PermissionDeniedError: bloqueado ? [
        'Cámara bloqueada',
        esMobil
          ? 'Toca el candado junto a la URL, entra a Permisos del sitio > Cámara > Permitir, y recarga.'
          : 'Haz clic en el candado de la barra de dirección, entra a Permisos del sitio > Cámara > Permitir.'
      ] : [
        'Se necesita acceso a la cámara',
        'Pulsa "Permitir" cuando el navegador lo solicite para que YOSO pueda detectar tus señas.'
      ],
      NotFoundError: [
        'No se detectó ninguna cámara',
        'Conecta una cámara a tu dispositivo e inténtalo de nuevo.'
      ],
      NotReadableError: [
        'La cámara está en uso',
        'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.'
      ],
      AbortError: [
        'La cámara está en uso',
        'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.'
      ],
    }

    const [titulo, desc] = mensajes[err?.name ?? ''] ?? [
      'No se pudo acceder a la cámara',
      'Verifica que tu dispositivo tenga cámara y que el navegador tenga permiso para usarla.'
    ]

    this.elEsTitulo.textContent = titulo
    this.elEsDesc.textContent   = desc

    if (bloqueado) {
      this.elEsReintentar.textContent = 'Recargar página'
      this.elEsReintentar.onclick = () => location.reload()
    } else {
      this.elEsReintentar.textContent = 'Reintentar'
      this.elEsReintentar.onclick = () => {
        this.ocultarEstadoVacio()
        onReintentar()
      }
    }

    this.elEstadoVacio.removeAttribute('hidden')
  }

  ocultarEstadoVacio(): void {
    this.elEstadoVacio.setAttribute('hidden', '')
  }

  // ── Toasts ────────────────────────────────────────────────────────────────
  mostrarToast(id: string, mensaje: string, tipo: 'info' | 'warn' | 'error' = 'info', duracion = 5000): void {
    this.ocultarToast(id)

    const toast = document.createElement('div')
    toast.className          = `toast toast-${tipo}`
    toast.dataset['toastId'] = id
    toast.setAttribute('role', 'alert')

    const icono   = document.createElement('span')
    icono.className = 'toast-icon'
    const svgWarn  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    const svgError = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    const svgInfo  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    icono.innerHTML = tipo === 'warn' ? svgWarn : tipo === 'error' ? svgError : svgInfo

    const texto   = document.createElement('span')
    texto.className   = 'toast-msg'
    texto.textContent = mensaje

    const cerrar  = document.createElement('button')
    cerrar.className = 'toast-close'
    cerrar.innerHTML = '&times;'
    cerrar.setAttribute('aria-label', 'Cerrar notificación')
    cerrar.onclick   = () => this.ocultarToast(id)

    toast.appendChild(icono)
    toast.appendChild(texto)
    toast.appendChild(cerrar)
    this.elToastRoot.appendChild(toast)

    // Forzar reflow para que la transición CSS funcione
    void toast.offsetWidth
    toast.classList.add('toast-visible')

    if (duracion > 0) {
      const timer = setTimeout(() => this.ocultarToast(id), duracion)
      this._timersToast.set(id, timer)
    }
  }

  ocultarToast(id: string): void {
    const existing = this.elToastRoot.querySelector<HTMLElement>(`[data-toast-id="${id}"]`)
    if (existing) {
      existing.classList.remove('toast-visible')
      existing.classList.add('toast-saliendo')
      setTimeout(() => existing.remove(), 300)
    }
    const timer = this._timersToast.get(id)
    if (timer !== undefined) { clearTimeout(timer); this._timersToast.delete(id) }
  }

  // ── Onboarding ────────────────────────────────────────────────────────────
  mostrarOnboarding(): Promise<void> {
    if (localStorage.getItem('yoso-v1-onboarded')) return Promise.resolve()
    return new Promise(resolve => {
      this.elOnboarding.removeAttribute('hidden')
      document.getElementById('onb-start')?.addEventListener('click', () => {
        this.elOnboarding.setAttribute('hidden', '')
        localStorage.setItem('yoso-v1-onboarded', '1')
        resolve()
      }, { once: true })
    })
  }

  // ── Panel de depuración ───────────────────────────────────────────────────
  actualizarDebug(p: CargaDebug): void {
    const pRojo = (p.probRed      * 100).toFixed(1)
    const pEfec = (p.confEfectiva * 100).toFixed(1)

    this.dbRojo.textContent         = pRojo + '%'
    this.dbEfectivo.textContent     = pEfec + '%'
    this.dbBarRojo.style.width      = pRojo + '%'
    this.dbBarEfect.style.width     = pEfec + '%'
    this.dbBarEfect.classList.toggle('below-threshold', p.confEfectiva < 0.75)

    if (p.distancia !== null && p.distRef !== null) {
      const pct = Math.min((p.distancia / (p.distRef * 2)) * 100, 100).toFixed(0)
      this.dbDist.textContent        = p.distancia.toFixed(3) + ' / ' + p.distRef.toFixed(3)
      this.dbBarDist.style.width     = pct + '%'
      this.dbBarDist.classList.toggle('high-dist', p.distancia > p.distRef * 1.5)
      this.dbDistRef.textContent     = 'P75=' + p.distRef.toFixed(3)
    } else {
      this.dbDist.textContent        = '—'
      this.dbBarDist.style.width     = '0%'
      this.dbDistRef.textContent     = '—'
    }

    // Celdas de votos del buffer
    const ganador = this._ganadorBuffer(p.bufferActual)
    this.dbBuffer.textContent = ''
    Array(10).fill('').map((_, i) => p.bufferActual[i] ?? '').forEach(ch => {
      const celda     = document.createElement('span')
      celda.className = 'vote-cell ' + (
        ch === ''      ? 'vote-empty' :
        ch === '-'     ? 'vote-miss'  :
        ch === ganador ? 'vote-hit vote-winner' : 'vote-hit'
      )
      celda.textContent = ch === '' ? '·' : ch === '-' ? '✗' : ch
      this.dbBuffer.appendChild(celda)
    })
    this.dbVotos.textContent = ganador
      ? `${ganador}: ${p.bufferActual.filter(x => x === ganador).length}/10`
      : '—'

    // RAM heap (Chrome only — performance.memory es no-estándar)
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    if (mem) {
      const usedMB  = (mem.usedJSHeapSize  / 1048576).toFixed(0)
      const limitMB = mem.jsHeapSizeLimit   / 1048576
      const pct     = Math.min((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100, 100).toFixed(0)
      this.dbMem.textContent        = usedMB + ' MB'
      this.dbBarMem.style.width     = pct + '%'
      this.dbBarMem.style.background = mem.usedJSHeapSize > limitMB * 0.7 * 1048576
        ? 'var(--red)' : 'var(--green)'
    } else {
      this.dbMem.textContent    = 'N/A'
      this.dbBarMem.style.width = '0%'
    }

    // Top-3
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

  // ── Aprendizaje — grid del alfabeto ───────────────────────────────────────
  resaltarSena(letra: string): void {
    if (letra === this.senaActiva) return
    this.limpiarSena()
    this.senaActiva = letra
    const tarjeta = this.elAlfabeto.querySelector<HTMLElement>(`[data-letra="${letra}"]`)
    if (tarjeta) {
      tarjeta.classList.add('sign-card-active')
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  limpiarSena(): void {
    if (!this.senaActiva) return
    this.elAlfabeto
      .querySelector(`[data-letra="${this.senaActiva}"]`)
      ?.classList.remove('sign-card-active')
    this.senaActiva = ''
  }

  // ── Privados ──────────────────────────────────────────────────────────────
  private _construirAlfabeto(): void {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letra => {
      const tarjeta = document.createElement('div')
      tarjeta.className          = 'sign-card'
      tarjeta.dataset['letra']   = letra

      const img = document.createElement('img')
      img.src       = signURI(letra)
      img.alt       = letra
      img.className = 'sign-card-img'

      const etiqueta = document.createElement('span')
      etiqueta.className   = 'sign-card-label'
      etiqueta.textContent = letra

      tarjeta.appendChild(img)
      tarjeta.appendChild(etiqueta)
      this.elAlfabeto.appendChild(tarjeta)
    })
  }

  private _vincularDebug(): void {
    const checkbox = document.getElementById('debug-checkbox') as HTMLInputElement | null
    const panel    = document.getElementById('debug-panel')
    if (checkbox && panel) {
      checkbox.addEventListener('change', () => {
        panel.style.display = checkbox.checked ? 'block' : 'none'
      })
    }
  }

  private _ganadorBuffer(buffer: string[]): string {
    if (!buffer.length) return ''
    const conteo: Record<string, number> = {}
    let ganador = '', maximo = 0
    for (const ch of buffer) {
      conteo[ch] = (conteo[ch] ?? 0) + 1
      if (conteo[ch] > maximo) { maximo = conteo[ch]; ganador = ch }
    }
    return ganador
  }

  private _destelloConfirmado(): void {
    this.elPrediccion.style.color = 'var(--cyan)'
    setTimeout(() => { this.elPrediccion.style.color = '' }, 300)
  }
}