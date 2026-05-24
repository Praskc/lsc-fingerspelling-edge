import { signURI } from '../lib/signs'

export class AlphabetLearn {
  private readonly grid: HTMLElement
  private activa = ''

  constructor() {
    this.grid = document.getElementById('alphabet-grid')!
    this._construir()
  }

  resaltar(letra: string): void {
    if (letra === this.activa) return
    this.limpiar()
    this.activa = letra
    const tarjeta = this.grid.querySelector<HTMLElement>(`[data-letra="${letra}"]`)
    if (tarjeta) {
      tarjeta.classList.add('sign-card-active')
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  limpiar(): void {
    if (!this.activa) return
    this.grid.querySelector(`[data-letra="${this.activa}"]`)
      ?.classList.remove('sign-card-active')
    this.activa = ''
  }

  private _construir(): void {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letra => {
      const tarjeta = document.createElement('div')
      tarjeta.className        = 'sign-card'
      tarjeta.dataset['letra'] = letra

      const img = document.createElement('img')
      img.src       = signURI(letra)
      img.alt       = letra
      img.className = 'sign-card-img'

      const etiqueta = document.createElement('span')
      etiqueta.className   = 'sign-card-label'
      etiqueta.textContent = letra

      tarjeta.appendChild(img)
      tarjeta.appendChild(etiqueta)
      this.grid.appendChild(tarjeta)
    })
  }
}
