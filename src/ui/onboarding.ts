export class Onboarding {
  private readonly el: HTMLElement

  constructor() {
    this.el = document.getElementById('onboarding')!
  }

  mostrar(): Promise<void> {
    if (localStorage.getItem('yoso-v1-onboarded')) return Promise.resolve()
    return new Promise(resolve => {
      this.el.removeAttribute('hidden')
      document.getElementById('onb-start')?.addEventListener('click', () => {
        this.el.setAttribute('hidden', '')
        localStorage.setItem('yoso-v1-onboarded', '1')
        resolve()
      }, { once: true })
    })
  }
}
