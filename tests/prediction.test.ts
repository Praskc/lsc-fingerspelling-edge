import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OutputPanel } from '../src/ui/output'
import { HUD } from '../src/ui/hud'

function montarDOM(): void {
  document.body.innerHTML = `
    <div id="tab-traductor"></div>
    <div id="final-text"></div>
    <div class="feed__roi"><span class="feed__roi-label"></span></div>
  `
}

describe('dueño único de #prediction', () => {
  beforeEach(() => {
    montarDOM()
    vi.useFakeTimers()
  })

  it('HUD no escribe #prediction', async () => {
    new OutputPanel()
    const hud = new HUD()
    await Promise.resolve()  // flush del queueMicrotask del bind()

    const pred = document.getElementById('prediction')!
    pred.textContent = 'X'
    hud.actualizarPrediccion('A', 0.9, 5, false)
    expect(pred.textContent).toBe('X')

    hud.limpiarMano()
    expect(pred.textContent).toBe('X')
  })

  it('setLetra cancela el timer anterior, sin escritura intermedia', () => {
    const panel = new OutputPanel()
    const pred = document.getElementById('prediction')!

    panel.setLetra('A')
    vi.advanceTimersByTime(100)
    panel.setLetra('B')      // antes de que A se pinte
    vi.advanceTimersByTime(81) // t=181: el timer de A ya habría disparado

    expect(pred.textContent).toBe('·')  // A nunca se pintó

    vi.advanceTimersByTime(100)         // t=281: timer de B
    expect(pred.textContent).toBe('B')
  })

  it('setLetra repetida con la misma letra no reinicia la animación', () => {
    const panel = new OutputPanel()
    panel.setLetra('A')
    vi.advanceTimersByTime(180)
    const pred = document.getElementById('prediction')!
    expect(pred.textContent).toBe('A')

    panel.setLetra('A')
    expect(pred.dataset.changing).toBe('false')
  })
})
