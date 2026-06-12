const ONBOARD_KEY     = 'yosoOnboarded'
const ONBOARD_VERSION = '4'

const ICON_FRAME = `<svg class="onb-step__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 5V1h4M15 5V1h-4M1 11v4h4M15 11v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const ICON_HAND  = `<svg class="onb-step__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 2v5M8 1v6M11 2v5M3 6v2a5 5 0 0010 0V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const ICON_CHECK = `<svg class="onb-step__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8l4 4 8-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Mano seña Y: todos los elementos desplazados +15px en X para que el pulgar
// no quede recortado por el borde izquierdo del viewBox.
function buildROI(): string {
  return `<div class="onb-roi" aria-hidden="true">
    <div class="roi-frame">
      <svg class="onb-hand" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <rect x="43" y="100" width="44" height="35"/>
        <rect x="31" y="52"  width="68" height="52" rx="16"/>
        <rect x="35" y="34"  width="13" height="24" rx="6"/>
        <rect x="51" y="30"  width="13" height="28" rx="6"/>
        <rect x="67" y="32"  width="13" height="25" rx="6"/>
        <rect x="83" y="8"   width="12" height="50" rx="6"/>
        <rect x="7"  y="66"  width="36" height="14" rx="7" transform="rotate(20, 31, 73)"/>
      </svg>
      <div class="onb-letter">Y</div>
    </div>
  </div>`
}

export class Onboarding {
  async mostrar(): Promise<void> {
    if (localStorage.getItem(ONBOARD_KEY) === ONBOARD_VERSION) return

    const root = document.getElementById('onboarding-root')
    if (!root) return

    root.innerHTML = `
      <div class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onb-title">
        <button class="onboarding-dismiss" id="onb-close" aria-label="Cerrar">&#215;</button>

        ${buildROI()}

        <p class="onb-title" id="onb-title">Así funciona YOSO</p>

        <ul class="onb-steps">
          <li class="onb-step">
            ${ICON_FRAME}
            <span>Coloca la mano <strong>dentro del recuadro</strong> de la cámara.</span>
          </li>
          <li class="onb-step">
            ${ICON_HAND}
            <span>Forma una seña del alfabeto LSC y <strong>aguanta quieto</strong>.</span>
          </li>
          <li class="onb-step">
            ${ICON_CHECK}
            <span>La letra se confirma <strong>sola</strong> en el panel. Sin presionar nada.</span>
          </li>
        </ul>

        <div class="onboarding-cta">
          <button class="onboarding-skip" id="onb-skip">saltar, exploraré solo</button>
          <button class="btn" id="onb-start">COMENZAR</button>
        </div>
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
      root.querySelector<HTMLButtonElement>('#onb-close')?.addEventListener('click', cerrar)
      root.querySelector<HTMLButtonElement>('#onb-skip')?.addEventListener('click', cerrar)
      root.addEventListener('click', e => { if (e.target === root) cerrar() })
      document.addEventListener('keydown', onKey)
    })
  }
}
