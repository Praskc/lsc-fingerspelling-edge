import { HUD }           from './hud'
import { DebugPanel }    from './debug'
import { Toast }         from './toast'
import { Onboarding }    from './onboarding'
import { AlphabetLearn } from './learn'
import { Splash }        from './splash'
import type { CargaDebug } from '../engine/types'

export class RenderizadorUI {
  private readonly hud:        HUD
  private readonly debug:      DebugPanel
  private readonly toast:      Toast
  private readonly onboarding: Onboarding
  private readonly learn:      AlphabetLearn
  private readonly splash:     Splash

  constructor() {
    this.hud        = new HUD()
    this.debug      = new DebugPanel()
    this.toast      = new Toast()
    this.onboarding = new Onboarding()
    this.learn      = new AlphabetLearn()
    this.splash     = new Splash()
  }

  // ── Splash / empty state ──────────────────────────────────────────────────
  mensajeSplash(mensaje: string, esError = false): void        { this.splash.mensaje(mensaje, esError) }
  ocultarSplash(): void                                         { this.splash.ocultar() }
  ocultarSkeleton(): void                                       { this.splash.ocultarSkeleton() }
  mostrarEstadoVacio(err: DOMException | null, onReintentar: () => void, bloqueado = false): void {
    this.splash.mostrarEstadoVacio(err, onReintentar, bloqueado)
  }
  ocultarEstadoVacio(): void                                    { this.splash.ocultarEstadoVacio() }

  // ── HUD / predicción / texto traducido ────────────────────────────────────
  estadoListo(estado: 'idle' | 'signing' | 'warning'): void    { this.hud.estadoListo(estado) }
  actualizarPrediccion(letra: string, confianza: number, latencia: number, esIzquierda: boolean): void {
    this.hud.actualizarPrediccion(letra, confianza, latencia, esIzquierda)
  }
  estadoMano(estado: string, esOptimo: boolean): void           { this.hud.estadoMano(estado, esOptimo) }
  limpiarMano(): void                                           { this.hud.limpiarMano() }
  actualizarROI(fueraZona: boolean): void                       { this.hud.actualizarROI(fueraZona) }
  limpiarROI(): void                                            { this.hud.limpiarROI() }
  agregarLetra(letra: string, borrar: boolean): void            { this.hud.agregarLetra(letra, borrar) }
  limpiarTexto(): void                                          { this.hud.limpiarTexto() }

  // ── Debug ─────────────────────────────────────────────────────────────────
  actualizarDebug(p: CargaDebug): void                          { this.debug.actualizar(p) }
  actualizarPerfFrame(mpMs: number, fps: number): void          { this.debug.actualizarPerf(mpMs, fps) }

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
