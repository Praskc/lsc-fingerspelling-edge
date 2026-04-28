// ============================================================================
// TYPES.TS — Interfaces y tipos del proyecto YOSO
// ============================================================================

export interface Landmark {
  x: number
  y: number
  z: number
}

export interface Handedness {
  label: 'Left' | 'Right'
  score: number
}

export interface HandsResult {
  image: HTMLVideoElement | HTMLCanvasElement
  multiHandLandmarks: Landmark[][]
  multiHandedness:    Handedness[]
}

export interface TopNItem {
  letter: string
  prob:   number
}

export interface DebugPayload {
  probRed:      number
  confEfectiva: number
  distancia:    number | null
  distRef:      number | null
  bufferActual: string[]
  topN:         TopNItem[]
}

export interface Centroide {
  coords:   Float32Array
  dist_ref: number
}

export type CentroidesMap = Record<string, Centroide>

export interface InferenceCallbacks {
  onLetraConfirmada:  (letra: string) => void
  onLetraInstantanea: (letra: string, confianza: number, latencia: number, isLeftCamera: boolean) => void
  onDebugUpdate:      (payload: DebugPayload) => void
}

export interface InferenceInitOptions {
  session:    unknown
  centroides: CentroidesMap | null
  callbacks:  InferenceCallbacks
}
