import { describe, it, expect, beforeEach } from 'vitest'
import { OutputPanel } from '../src/ui/output'

function montarDOM(): void {
  document.body.innerHTML = `<div id="tab-traductor"></div><div id="final-text"></div>`
}

describe('OutputPanel stream y buffer', () => {
  beforeEach(montarDOM)

  it('renderStream genera el path esperado', () => {
    const panel = new OutputPanel()
    panel.actualizarStream(0.5)
    panel.actualizarStream(0.5)
    panel.actualizarStream(0.5)

    const line = document.getElementById('stream-line')!
    expect(line.getAttribute('d')).toBe('M0.0,65.0L2.0,65.0L4.0,65.0')

    const avg = document.getElementById('stream-avg')!
    expect(avg.textContent).toBe('avg 50%')
  })

  it('el promedio sigue correcto al desbordar STREAM_MAX', () => {
    const panel = new OutputPanel()
    for (let i = 0; i < 150; i++) panel.actualizarStream(0)
    for (let i = 0; i < 150; i++) panel.actualizarStream(1)
    const avg = document.getElementById('stream-avg')!
    expect(avg.textContent).toBe('avg 100%')
  })

  it('setBuffer marca celdas llenas y parcial', () => {
    const panel = new OutputPanel()
    panel.setBuffer(3)
    const cells = document.querySelectorAll<HTMLElement>('.buffer-block__cell')
    expect(cells[0].dataset.on).toBe('true')
    expect(cells[1].dataset.on).toBe('true')
    expect(cells[2].dataset.on).toBe('partial')
    expect(cells[3].dataset.on).toBeUndefined()

    const count = document.querySelector('.buffer-block__count')!
    expect(count.textContent).toBe('03/9')
  })
})
