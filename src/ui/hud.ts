export class HUD {
  private readonly elIndicadorListo: HTMLElement
  private readonly elEtiquetaListo:  HTMLElement
  private readonly elPrediccion:     HTMLElement
  private readonly elConfianza:      HTMLElement
  private readonly elMetricaTiempo:  HTMLElement
  private readonly elMetricaMano:    HTMLElement
  private readonly elMetricaEstado:  HTMLElement
  private readonly elTextoFinal:     HTMLElement
  private readonly elROI:            HTMLElement
  private textoAcumulado = ''

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
  }

  estadoListo(estado: 'idle' | 'signing' | 'warning'): void {
    this.elIndicadorListo.className = `ready-indicator ${estado}`
    this.elEtiquetaListo.textContent =
      estado === 'signing' ? 'LEYENDO...'
      : estado === 'warning' ? 'FUERA DE ZONA'
      : 'LISTO PARA LEER'
  }

  actualizarPrediccion(letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    this.elMetricaTiempo.textContent = latencia.toFixed(1) + ' ms'
    this.elMetricaMano.textContent   = esIzquierda ? 'IZQUIERDA' : 'DERECHA'
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

  actualizarROI(fueraZona: boolean): void {
    this.elROI.classList.toggle('roi-fuera',  fueraZona)
    this.elROI.classList.toggle('roi-activa', !fueraZona)
  }

  limpiarROI(): void {
    this.elROI.classList.remove('roi-fuera', 'roi-activa')
  }

  agregarLetra(letra: string, borrar: boolean): void {
    this.textoAcumulado = borrar
      ? this.textoAcumulado.slice(0, -1)
      : this.textoAcumulado + letra
    this.elTextoFinal.textContent = this.textoAcumulado
    this._destellar()
  }

  limpiarTexto(): void {
    this.textoAcumulado           = ''
    this.elTextoFinal.textContent = ''
  }

  private _destellar(): void {
    this.elPrediccion.style.color = 'var(--cyan)'
    setTimeout(() => { this.elPrediccion.style.color = '' }, 300)
  }
}
