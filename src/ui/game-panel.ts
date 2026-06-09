// ============================================================================
// GAME PANEL · Template del modo Entrenamiento.
// Arquitectura propia: la palabra es el hero (no drop-cap + texto pequeño),
// stats arriba a la derecha, feedback debajo. Sin firma de autor (vive en
// el footer global del sitio).
// Mantiene los IDs que GameManager (src/game/game.ts) consulta.
// ============================================================================

export class GamePanel {
  constructor() {
    this.render()
  }

  private render(): void {
    const panel = document.getElementById('tab-entrenamiento')
    if (!panel) return
    panel.innerHTML = `
      <section class="game-section">
        <header class="game-head">
          <div class="game-eyebrow">DELETREA</div>
          <div class="game-stats">
            <span class="game-stat">
              <span class="game-stat__label">NIVEL</span>
              <span id="nivel-label" class="game-stat__value">NOVATO</span>
            </span>
            <span class="game-stat">
              <span class="game-stat__label">PUNTOS</span>
              <span id="puntuacion" class="game-stat__value">0</span>
            </span>
          </div>
        </header>

        <div class="game-word-wrap">
          <div id="letra-objetivo" class="game-word" aria-live="polite"></div>
        </div>

        <div class="game-hint-slot">
          <img id="imagen-pista" class="imagen-pista" alt="Guía de la seña" aria-hidden="true" />
        </div>

        <footer class="game-foot">
          <div id="feedback-mensaje" class="game-feedback fb-idle" role="status">HAZ LA SEÑA…</div>
          <div class="game-progress">
            <div class="game-progress__bar">
              <div id="progreso-bar" class="game-progress__fill"></div>
            </div>
            <span id="progreso-texto" class="game-progress__count">0/3</span>
          </div>
        </footer>
      </section>
    `
  }
}
