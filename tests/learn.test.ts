import { describe, it, expect, beforeEach } from 'vitest'
import { AlphabetLearn } from '../src/ui/learn'

function contarMutaciones(fn: () => void): number {
  const obs = new MutationObserver(() => {})
  obs.observe(document.body, { subtree: true, attributes: true })
  fn()
  const n = obs.takeRecords().length
  obs.disconnect()
  return n
}

describe('AlphabetLearn', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="tab-aprendizaje"></div>`
  })

  it('resaltar repetida con la misma letra no toca el DOM', () => {
    const learn = new AlphabetLearn()
    learn.resaltar('A')
    expect(contarMutaciones(() => learn.resaltar('A'))).toBe(0)
  })

  it('resaltar nueva letra marca active y la anterior queda seen', () => {
    const learn = new AlphabetLearn()
    learn.resaltar('A')
    learn.resaltar('B')
    const celdaA = document.querySelector<HTMLElement>('[data-letter="A"]')!
    const celdaB = document.querySelector<HTMLElement>('[data-letter="B"]')!
    expect(celdaA.dataset.state).toBe('seen')
    expect(celdaB.dataset.state).toBe('active')
  })

  it('limpiar repetido no toca el DOM', () => {
    const learn = new AlphabetLearn()
    learn.resaltar('A')
    learn.limpiar()
    expect(contarMutaciones(() => learn.limpiar())).toBe(0)
  })
})
