export interface Punto {
  x: number
  y: number
  z: number
}

export interface Lateralidad {
  label: 'Left' | 'Right'
  score: number
}

export interface ResultadoManos {
  image:               HTMLVideoElement | HTMLCanvasElement
  multiHandLandmarks:  Punto[][]
  multiHandedness:     Lateralidad[]
}

export interface ItemTop {
  letra: string
  prob:  number
}

export interface CargaDebug {
  probRed:        number
  confEfectiva:   number
  distancia:      number | null
  distRef:        number | null
  bufferActual:   string[]
  topN:           ItemTop[]
  bufferProgreso: number   // 0–1, maxPeso acumulado / PESO_MINIMO_VOTOS
}

export interface Centroide {
  coords:   Float32Array
  dist_ref: number
}

export type MapaCentroides = Record<string, Centroide>

export interface CallbacksInferencia {
  alConfirmarLetra:    (letra: string) => void
  alDetectarLetra:     (letra: string, confianza: number, latInferencia: number, latProcesamiento: number, esCamaraIzquierda: boolean) => void
  alActualizarDebug:   (carga: CargaDebug) => void
}

export interface OpcionesInicioInferencia {
  sesion:     unknown
  centroides: MapaCentroides | null
  callbacks:  CallbacksInferencia
}
