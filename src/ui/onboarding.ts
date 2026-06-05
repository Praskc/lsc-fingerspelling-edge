// ============================================================================
// ONBOARDING · Modal editorial de primera visita
// Mantiene API: mostrar(): Promise<void>
// Versiona localStorage clave yosoOnboarded a '2' para forzar re-onboarding.
// ============================================================================

const ONBOARD_KEY = 'yosoOnboarded'
const ONBOARD_VERSION = '2'

export class Onboarding {
  async mostrar(): Promise<void> {
    if (localStorage.getItem(ONBOARD_KEY) === ONBOARD_VERSION) return

    const root = document.getElementById('onboarding-root')
    if (!root) return

    root.innerHTML = `
      <div class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onb-title">
        <p class="onboarding-eyebrow" id="onb-title">GUÍA RÁPIDA · 3 PASOS</p>
        <ol class="onboarding-steps">
          <li class="onboarding-step">
            <span class="onboarding-step__n">01</span>
            <span class="onboarding-step__text">Coloca tu mano <strong>dentro del recuadro</strong>.</span>
          </li>
          <li class="onboarding-step">
            <span class="onboarding-step__n">02</span>
            <span class="onboarding-step__text">Forma la seña y <strong>mantén la mano estable</strong>.</span>
          </li>
          <li class="onboarding-step">
            <span class="onboarding-step__n">03</span>
            <span class="onboarding-step__text">La letra aparece <strong>automáticamente</strong> en el panel.</span>
          </li>
        </ol>
        <button class="btn" id="onb-start">COMENZAR  →</button>
        <p class="onboarding-foot">Esto solo aparece la primera vez</p>
      </div>
    `

    root.dataset.open = 'true'

    return new Promise(resolve => {
      const cerrar = (): void => {
        root.dataset.open = 'false'
        document.removeEventListener('keydown', onKey)
        localStorage.setItem(ONBOARD_KEY, ONBOARD_VERSION)
        resolve()
      }
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') cerrar()
      }
      root.querySelector<HTMLButtonElement>('#onb-start')!.addEventListener('click', cerrar)
      root.addEventListener('click', e => { if (e.target === root) cerrar() })
      document.addEventListener('keydown', onKey)
    })
  }
}
