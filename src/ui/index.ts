import { HUD }           from './hud'
import { DebugPanel }    from './debug'
import { Toast }         from './toast'
import { Onboarding }    from './onboarding'
import { AlphabetLearn } from './learn'
import { Splash }        from './splash'
import { PanelLeft }     from './panel-left'
import { OutputPanel }   from './output'
import { GamePanel }     from './game-panel'
import { SiteFooter }    from './site-footer'
import type { CargaDebug } from '../engine/types'

export class RenderizadorUI {
  private readonly panelLeft:  PanelLeft
  private readonly output:     OutputPanel
  private readonly hud:        HUD
  private readonly debug:      DebugPanel
  private readonly toast:      Toast
  private readonly onboarding: Onboarding
  private readonly learn:      AlphabetLearn
  private readonly splash:     Splash

  constructor() {
    // Orden importa: PanelLeft + OutputPanel + GamePanel + AlphabetLearn crean DOM.
    // HUD y GameManager consultan IDs ya creados.
    this.panelLeft  = new PanelLeft()
    this.output     = new OutputPanel()
    new GamePanel()  // solo necesita renderizar el template para que GameManager encuentre IDs
    new SiteFooter() // firma global de autor en el footer
    this.hud        = new HUD()
    this.debug      = new DebugPanel()
    this.toast      = new Toast()
    this.onboarding = new Onboarding()
    this.learn      = new AlphabetLearn()
    this.splash     = new Splash()

    // Puente HUD → OutputPanel via custom events
    window.addEventListener('yoso:letra', (e) => {
      const detail = (e as CustomEvent<{ letra: string; borrar: boolean }>).detail
      this.output.agregarLetra(detail.letra, detail.borrar)
    })
    window.addEventListener('yoso:texto-clear', () => this.output.limpiarTexto())
  }

  // ── Splash / empty state ──────────────────────────────────────────────────
  mensajeSplash(mensaje: string, esError = false): void        { this.splash.mensaje(mensaje, esError) }
  ocultarSplash(): void                                         { this.splash.ocultar() }
  mostrarEstadoVacio(err: DOMException | null, onReintentar: () => void, bloqueado = false): void {
    this.splash.mostrarEstadoVacio(err, onReintentar, bloqueado)
    this.panelLeft.setLive(false)
  }
  ocultarEstadoVacio(): void                                    { this.splash.ocultarEstadoVacio() }

  // ── HUD / predicción / texto traducido ────────────────────────────────────
  estadoListo(estado: 'idle' | 'signing' | 'warning'): void {
    this.hud.estadoListo(estado)
    // El motor está activo en cualquiera de los 3 estados (idle = esperando seña).
    // Solo se apaga si falla la cámara, ver mostrarEstadoVacio.
    this.panelLeft.setLive(true)
  }
  actualizarPrediccion(letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    this.hud.actualizarPrediccion(letra, confianza, latencia, esIzquierda)
    this.output.setLetra(letra)
    this.output.actualizarStream(confianza)
  }
  estadoMano(estado: string, esOptimo: boolean): void           { this.hud.estadoMano(estado, esOptimo) }
  limpiarMano(): void {
    this.hud.limpiarMano()
    this.output.setLetra('')
  }
  actualizarROI(fueraZona: boolean): void                       { this.hud.actualizarROI(fueraZona) }
  limpiarROI(): void                                            { this.hud.limpiarROI() }
  agregarLetra(letra: string, borrar: boolean): void            { this.hud.agregarLetra(letra, borrar) }
  limpiarTexto(): void                                          { this.hud.limpiarTexto() }

  // ── Debug ─────────────────────────────────────────────────────────────────
  actualizarDebug(p: CargaDebug): void                          {
    this.debug.actualizar(p)
    // Buffer voting visible al usuario: número de votos acumulados, máximo 9.
    this.output.setBuffer(p.bufferActual.length, 9)
  }
  actualizarPerfFrame(mpMs: number, fps: number): void          {
    this.debug.actualizarPerf(mpMs, fps)
    this.hud.actualizarFps(fps)
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  mostrarToast(id: string, msg: string, tipo: 'info' | 'warn' | 'error' = 'info', dur = 5000): void {
    this.toast.mostrar(id, msg, tipo, dur)
  }
  ocultarToast(id: string): void                                { this.toast.ocultar(id) }

  // ── Onboarding ────────────────────────────────────────────────────────────
  mostrarOnboarding(): Promise<void>                            { return this.onboarding.mostrar() }

  // ── Aprendizaje ───────────────────────────────────────────────────────────
  resaltarSena(letra: string): void                             { this.learn.resaltar(letra) }
  limpiarSena(): void                                           { this.learn.limpiar() }
}
