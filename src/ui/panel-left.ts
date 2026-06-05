// ============================================================================
// PANEL LEFT · Wordmark, EN VIVO, video, HUD shell
// El video y canvas mantienen sus clases originales (input_video, output_canvas)
// para que app.ts los siga encontrando con querySelector.
// ============================================================================

export class PanelLeft {
  private root: HTMLElement
  private liveIndicator: HTMLElement | null = null

  constructor() {
    this.root = document.getElementById('panel-left')!
    if (!this.root) return
    this.render()
    this.liveIndicator = this.root.querySelector('.live-indicator')
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="panel-header">
        <div class="panel-header__top">
          <span class="panel-header__eyebrow">LSC · SINCELEJO · v2.0</span>
          <span class="live-indicator" data-state="off">SIN MOTOR</span>
        </div>
        <h1 class="wordmark">YOSO</h1>
        <p class="wordmark-slogan">You only sign once</p>
      </header>

      <div class="video-frame" id="canvas-wrapper">
        <video class="input_video" autoplay playsinline aria-hidden="true"></video>
        <canvas class="output_canvas"></canvas>
        <div class="roi-overlay" id="roi-overlay" aria-hidden="true"></div>
        <span class="corner corner__tl"><span class="chrome red"></span><span class="chrome blue"></span></span>
        <span class="corner corner__tr"><span class="chrome blue"></span><span class="chrome red"></span></span>
        <span class="corner corner__bl"><span class="chrome red"></span><span class="chrome blue"></span></span>
        <span class="corner corner__br"><span class="chrome blue"></span><span class="chrome red"></span></span>

        <div id="empty-state" class="empty-state" hidden>
          <p class="empty-state__eyebrow">SIN ACCESO A CÁMARA</p>
          <div class="empty-state__glyph">?</div>
          <p class="empty-state__title">YOSO necesita acceso a la cámara para reconocer las señas.</p>
          <button class="btn" id="es-retry">REINTENTAR ↻</button>
          <p class="empty-state__hint">Verifica permisos en tu navegador</p>
        </div>
      </div>

      <div class="hud" id="hud">
        <div class="hud__block hud__block--lat">
          <div class="hud__label">LATENCIA</div>
          <div class="hud__value" id="m-time">--<span class="unit">ms</span></div>
        </div>
        <div class="hud__block hud__block--hand">
          <div class="hud__label">MANO</div>
          <div class="hud__value" id="m-hand" data-state="off">ND</div>
        </div>
        <div class="hud__block hud__block--conf">
          <div class="hud__label">CONFIANZA</div>
          <div class="hud__value" id="m-conf" data-state="off">--<span class="unit">%</span></div>
        </div>
        <div class="hud__block hud__block--fps">
          <div class="hud__label">FPS</div>
          <div class="hud__value" id="m-fps">60.0</div>
        </div>
      </div>
    `
  }

  setLive(activo: boolean): void {
    if (!this.liveIndicator) return
    this.liveIndicator.dataset.state = activo ? 'on' : 'off'
    this.liveIndicator.textContent = activo ? 'EN VIVO' : 'SIN MOTOR'
  }
}
