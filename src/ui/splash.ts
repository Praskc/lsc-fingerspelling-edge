export class Splash {
  private readonly elSplash:     HTMLElement
  private readonly elMsg:        HTMLElement
  private readonly elVacio:      HTMLElement
  private readonly elTitulo:     HTMLElement
  private readonly elDesc:       HTMLElement
  private readonly elReintentar: HTMLElement

  constructor() {
    this.elSplash     = document.getElementById('splash-screen')!
    this.elMsg        = document.getElementById('splash-msg')!
    this.elVacio      = document.getElementById('empty-state')!
    this.elTitulo     = document.getElementById('es-title')!
    this.elDesc       = document.getElementById('es-desc')!
    this.elReintentar = document.getElementById('es-retry')!
  }

  mensaje(texto: string, esError = false): void {
    this.elMsg.textContent = texto
    this.elMsg.classList.toggle('splash-error', esError)
  }

  ocultar(): void {
    this.elSplash.classList.add('splash-hidden')
  }

  ocultarSkeleton(): void {
    document.getElementById('canvas-skeleton')?.classList.add('skeleton-oculto')
  }

  mostrarEstadoVacio(err: DOMException | null, onReintentar: () => void, bloqueado = false): void {
    const esMobil = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0

    const mensajePermiso: [string, string] = bloqueado ? [
      'Cámara bloqueada',
      esMobil
        ? 'Toca el candado junto a la URL, entra a Permisos del sitio > Cámara > Permitir, y recarga.'
        : 'Haz clic en el candado de la barra de dirección, entra a Permisos del sitio > Cámara > Permitir.'
    ] : [
      'Se necesita acceso a la cámara',
      'Pulsa "Permitir" cuando el navegador lo solicite para que YOSO pueda detectar tus señas.'
    ]

    const mensajes: Record<string, [string, string]> = {
      NotAllowedError:       mensajePermiso,
      PermissionDeniedError: mensajePermiso,
      NotFoundError:    ['No se detectó ninguna cámara',   'Conecta una cámara a tu dispositivo e inténtalo de nuevo.'],
      NotReadableError: ['La cámara está en uso', 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.'],
      AbortError:       ['La cámara está en uso', 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.'],
    }

    const [titulo, desc] = mensajes[err?.name ?? ''] ?? [
      'No se pudo acceder a la cámara',
      'Verifica que tu dispositivo tenga cámara y que el navegador tenga permiso para usarla.'
    ]

    this.elTitulo.textContent = titulo
    this.elDesc.textContent   = desc

    if (bloqueado) {
      this.elReintentar.textContent = 'Recargar página'
      this.elReintentar.onclick = () => location.reload()
    } else {
      this.elReintentar.textContent = 'Reintentar'
      this.elReintentar.onclick = () => {
        this.ocultarEstadoVacio()
        onReintentar()
      }
    }

    this.elVacio.removeAttribute('hidden')
  }

  ocultarEstadoVacio(): void {
    this.elVacio.setAttribute('hidden', '')
  }
}
