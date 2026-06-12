import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameManager } from '../src/game/game'

function montarDOM(): void {
  document.body.innerHTML = `
    <div id="letra-objetivo"></div>
    <div id="feedback-mensaje"></div>
    <span id="puntuacion"></span>
    <span id="nivel-label"></span>
    <span id="progreso-texto"></span>
    <div id="progreso-bar"></div>
    <img id="imagen-pista"/>
  `
}

function capturar(tipo: string): Array<Record<string, unknown>> {
  const eventos: Array<Record<string, unknown>> = []
  window.addEventListener('yoso:juego', (e) => {
    const d = (e as CustomEvent).detail
    if (d.tipo === tipo) eventos.push(d)
  })
  return eventos
}

async function juegoActivoConBancoLocal(): Promise<GameManager> {
  // fetch falla: GameManager cae al banco local determinista
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
  const juego = new GameManager()
  await juego.activar()
  return juego
}

function palabraEnPantalla(): string {
  return document.getElementById('letra-objetivo')!.textContent ?? ''
}

describe('GameManager emite yoso:juego', () => {
  beforeEach(() => {
    montarDOM()
    vi.useFakeTimers()
  })

  it('emite fuente local cuando Datamuse falla', async () => {
    const eventos = capturar('fuente')
    await juegoActivoConBancoLocal()
    expect(eventos.at(-1)).toMatchObject({ tipo: 'fuente', fuente: 'local' })
  })

  it('emite palabra con racha al completar', async () => {
    const eventos = capturar('palabra')
    const juego = await juegoActivoConBancoLocal()

    const palabra = palabraEnPantalla()
    for (const ch of palabra) juego.onLetraConfirmada(ch)

    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({ tipo: 'palabra', palabra, racha: 1 })
  })

  it('emite intentos en cada error y la racha se rompe al omitir', async () => {
    const juego = await juegoActivoConBancoLocal()
    // Capturo DESPUÉS del setup para no incluir el intentos:0 inicial
    const intentos = capturar('intentos')
    const omitidas = capturar('omitida')

    const letraMala = palabraEnPantalla()[0] === 'Z' ? 'A' : 'Z'
    juego.onLetraConfirmada(letraMala)
    juego.onLetraConfirmada(letraMala)
    juego.onLetraConfirmada(letraMala)  // tercer error: palabra omitida

    expect(intentos.map(e => e.errores)).toEqual([1, 2, 3])
    expect(omitidas).toHaveLength(1)
  })
})
