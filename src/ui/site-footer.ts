// ============================================================================
// SITE FOOTER · Renderiza la firma global del autor una sola vez.
// Reemplaza la firma duplicada que vivía en cada panel.
// ============================================================================

export class SiteFooter {
  constructor() {
    this.render()
  }

  private render(): void {
    const root = document.getElementById('site-footer')
    if (!root) return
    root.innerHTML = `
      <span class="site-footer__meta">LSC · SINCELEJO · v2.0</span>
      <span class="site-footer__sig">
        Developed by <strong>Esteban Cotera</strong>
      </span>
      <a class="site-footer__link" href="https://github.com/Praskc" target="_blank" rel="noopener" aria-label="GitHub Praskc">@Praskc ↗</a>
    `
  }
}
