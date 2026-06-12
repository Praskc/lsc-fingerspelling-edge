import { describe, it, expect, beforeEach } from 'vitest'
import { HUD } from '../src/ui/hud'
import { PanelLeft } from '../src/ui/panel-left'

function montarDOM(): void {
  document.body.innerHTML = `
    <span id="m-time"></span><span id="m-hand"></span>
    <span id="m-estado"></span><span id="m-conf"></span>
    <span id="m-fps"></span>
    <div class="feed__roi"><span class="feed__roi-label"></span></div>
    <span class="feed__live"></span>
  `
}

async function hudListo(): Promise<HUD> {
  const hud = new HUD()
  await Promise.resolve()  // flush del bind()
  return hud
}

function contarMutaciones(fn: () => void): number {
  const obs = new MutationObserver(() => {})
  obs.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
  })
  fn()
  const n = obs.takeRecords().length
  obs.disconnect()
  return n
}

describe('guards de render por frame', () => {
  beforeEach(montarDOM)

  it('limpiarMano repetida no toca el DOM', async () => {
    const hud = await hudListo()
    hud.limpiarMano()
    expect(contarMutaciones(() => hud.limpiarMano())).toBe(0)
  })

  it('limpiarMano vuelve a escribir si cambió fueraZona', async () => {
    const hud = await hudListo()
    hud.limpiarMano()
    hud.actualizarROI(true)
    expect(contarMutaciones(() => hud.limpiarMano())).toBeGreaterThan(0)
  })

  it('estadoMano repetido no toca el DOM', async () => {
    const hud = await hudListo()
    hud.estadoMano('Óptimo', true)
    expect(contarMutaciones(() => hud.estadoMano('Óptimo', true))).toBe(0)
  })

  it('actualizarROI repetido no toca el DOM', async () => {
    const hud = await hudListo()
    hud.actualizarROI(true)
    expect(contarMutaciones(() => hud.actualizarROI(true))).toBe(0)
  })

  it('limpiarROI repetido no toca el DOM', async () => {
    const hud = await hudListo()
    hud.actualizarROI(true)
    hud.limpiarROI()
    expect(contarMutaciones(() => hud.limpiarROI())).toBe(0)
  })

  it('setLive repetido no toca el DOM', () => {
    const panel = new PanelLeft()
    panel.setLive(true)
    expect(contarMutaciones(() => panel.setLive(true))).toBe(0)
  })
})
