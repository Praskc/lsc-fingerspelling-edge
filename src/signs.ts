// ============================================================================
// SIGNS.TS — Diagramas SVG del alfabeto ASL
// Perspectiva: observador (como en libros de texto ASL)
// Obra original CC0 — posiciones de dedos basadas en ASL estándar
// ============================================================================

const C   = '#38BDF8'
const F   = 'rgba(56,189,248,0.46)'
const FT  = 'rgba(180,236,255,0.28)'
const FM  = 'rgba(56,189,248,0.17)'
const FD  = 'rgba(56,189,248,0.07)'
const SW  = '2.2'
const SW2 = '1.6'

// translate(80,0) scale(-1,1) voltea todos los paths al plano del observador:
// el meñique queda a la derecha, el índice a la izquierda, el pulgar a la izquierda.
const wrap = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100">` +
  `<g transform="translate(80,0) scale(-1,1)" stroke="${C}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">` +
  body + `</g></svg>`

// ── Formas base ──────────────────────────────────────────────────────────────

// Dedo extendido — cónico con bezier, nudillo PIP y uña
// Centros: meñique=18 · anular=30 · medio=42 · índice=54
// Ancho: base 14px → PIP 11px → punta 9px
const fu = (cx: number): string =>
  `<path d="M${cx-7},62 C${cx-8},50 ${cx-5.5},26 ${cx-4},18 Q${cx},13 ${cx+4},18 C${cx+5.5},26 ${cx+8},50 ${cx+7},62 Z" ` +
  `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
  `<path d="M${cx-5.5},36 Q${cx},34 ${cx+5.5},36" fill="none" stroke="rgba(56,189,248,0.38)" stroke-width="1"/>` +
  `<ellipse cx="${cx}" cy="15.5" rx="3.8" ry="2.4" fill="${FT}" stroke="none"/>`

// Dedo extendido rotado — V, R, K, P, W
const fuR = (cx: number, deg: number): string => {
  const py = 38
  return (
    `<path d="M${cx-7},62 C${cx-8},50 ${cx-5.5},26 ${cx-4},18 Q${cx},13 ${cx+4},18 C${cx+5.5},26 ${cx+8},50 ${cx+7},62 Z" ` +
    `fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(${deg},${cx},${py})"/>` +
    `<path d="M${cx-5.5},36 Q${cx},34 ${cx+5.5},36" fill="none" stroke="rgba(56,189,248,0.38)" stroke-width="1" transform="rotate(${deg},${cx},${py})"/>` +
    `<ellipse cx="${cx}" cy="15.5" rx="3.8" ry="2.4" fill="${FT}" stroke="none" transform="rotate(${deg},${cx},${py})"/>`
  )
}

// Dedo doblado — stub orgánico
const fh = (cx: number): string =>
  `<path d="M${cx-6},62 C${cx-7},58 ${cx-7},53 ${cx-5},50 Q${cx},48 ${cx+5},50 C${cx+7},53 ${cx+7},58 ${cx+6},62 Z" ` +
  `fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`

// Palma — orgánica con nudillos MCP y crease
const pm =
  `<path d="M8,62 C8,60 9,57 11,55 Q18,51 25,55 Q30,50 37,55 Q42,49 49,54 Q54,51 61,56 C64,58 66,60 65,63 L63,78 Q61,90 50,91 L22,91 Q12,89 10,78 Z" ` +
  `fill="${FM}" stroke="${C}" stroke-width="${SW2}"/>` +
  `<path d="M14,74 Q38,69 62,72" fill="none" stroke="rgba(56,189,248,0.2)" stroke-width="1.2"/>` +
  `<path d="M24,56 L22,65 M36,55 L34,65 M48,55 L46,65" fill="none" stroke="rgba(56,189,248,0.12)" stroke-width="1"/>`

// Muñeca — cilíndrica
const wr =
  `<path d="M20,89 C16,89 13,92 13,96 Q13,100 40,100 Q67,100 67,96 C67,92 64,89 60,89" ` +
  `fill="${FM}" stroke="${C}" stroke-width="${SW2}"/>`

// Puño cerrado — nudillos en arco
const fist =
  `<path d="M10,38 Q17,32 24,35 Q30,30 37,33 Q43,29 50,33 Q57,30 64,35 C69,38 71,44 71,56 L71,72 Q71,87 58,90 L18,90 Q8,87 8,72 L8,56 C8,44 9,39 10,38 Z" ` +
  `fill="${FM}" stroke="${C}" stroke-width="2"/>`

// ── Pulgares ─────────────────────────────────────────────────────────────────

// Pulgar lateral derecho en coordenadas de dibujo → izquierda para el observador (A, Y)
const tOut =
  `<path d="M61,73 C59,68 59,55 62,47 Q65,41 70,42 Q75,44 74,52 C73,62 70,74 67,77 Q63,78 61,73 Z" ` +
  `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
  `<ellipse cx="70" cy="43" rx="3" ry="4" fill="${FT}" stroke="none" transform="rotate(12,70,43)"/>`

// Pulgar horizontal (L)
const tLeft =
  `<path d="M5,67 C5,63 7,60 12,59 L35,58 C39,58 42,60 42,64 C42,68 39,70 35,71 L12,71 C7,71 5,71 5,67 Z" ` +
  `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
  `<ellipse cx="39.5" cy="64.5" rx="4" ry="3" fill="${FT}" stroke="none"/>`

// Pulgar cruzando la palma (B)
const tIn =
  `<path d="M24,75 C22,71 23,67 27,66 L50,65 C54,65 56,67 56,71 C56,75 54,77 50,78 L27,78 C23,78 24,79 24,75 Z" ` +
  `fill="${F}" stroke="${C}" stroke-width="${SW2}"/>`

// Pulgar bajo los dedos (E, M, N)
const tUnder =
  `<path d="M28,77 C26,74 27,71 30,70 L44,69 C48,69 50,71 50,74 C50,77 48,79 44,80 L30,80 C27,80 28,81 28,77 Z" ` +
  `fill="${FD}" stroke="${C}" stroke-width="1.4"/>`

// ── 26 letras ────────────────────────────────────────────────────────────────

export const SIGNS: Record<string, string> = {

  // ── A  Puño, pulgar al costado
  A: wrap(fist + wr + tOut),

  // ── B  4 dedos extendidos, pulgar cruzado
  B: wrap(pm + wr + fu(18) + fu(30) + fu(42) + fu(54) + tIn),

  // ── C  Mano curvada — abertura mira al observador tras el volteo
  C: wrap(
    wr +
    `<path d="M66,16 A33,40 0 1,0 66,84" ` +
    `fill="${FM}" stroke="${C}" stroke-width="2.8"/>` +
    `<ellipse cx="64" cy="18" rx="5" ry="3.5" fill="${FT}" stroke="none"/>` +
    `<ellipse cx="64" cy="82" rx="5" ry="3.5" fill="${FT}" stroke="none"/>`
  ),

  // ── D  Índice arriba, resto forman anillo hacia el pulgar
  D: wrap(
    pm + wr + fu(54) +
    `<path d="M52,14 Q24,20 14,44 Q12,62 28,68 Q42,72 52,65" ` +
    `fill="${FM}" stroke="${C}" stroke-width="2.2"/>`
  ),

  // ── E  Todos doblados, pulgar bajo
  E: wrap(pm + wr + fh(18) + fh(30) + fh(42) + fh(54) + tUnder),

  // ── F  Meñique/anular/medio arriba; índice+pulgar círculo
  F: wrap(
    pm + wr +
    fu(18) + fu(30) + fu(42) +
    `<circle cx="62" cy="38" r="12" fill="${FM}" stroke="${C}" stroke-width="2.2"/>` +
    `<circle cx="62" cy="38" r="5" fill="rgba(12,17,24,0.85)" stroke="${C}" stroke-width="1.8"/>`
  ),

  // ── G  Índice y pulgar horizontales apuntando al frente
  G: wrap(
    pm + wr +
    `<path d="M26,25 C30,24 54,22 62,22 Q68,22 68,28 Q68,35 62,35 L26,36 C22,36 21,33 21,30 C21,27 23,25 26,25 Z" ` +
    `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="66" cy="28.5" rx="3.5" ry="5" fill="${FT}" stroke="none"/>` +
    `<path d="M26,40 C30,39 48,38 54,38 Q58,38 58,42 Q58,47 54,47 L26,48 C22,48 21,46 21,44 C21,41 23,40 26,40 Z" ` +
    `fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── H  Índice y medio horizontales paralelos
  H: wrap(
    pm + wr +
    `<path d="M8,20 C12,19 50,17 58,17 Q65,17 65,23 Q65,30 58,30 L8,31 C4,31 3,29 3,26 C3,22 5,20 8,20 Z" ` +
    `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="63" cy="23.5" rx="3.5" ry="5" fill="${FT}" stroke="none"/>` +
    `<path d="M8,35 C12,34 50,32 58,32 Q65,32 65,38 Q65,45 58,45 L8,46 C4,46 3,44 3,41 C3,37 5,35 8,35 Z" ` +
    `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="63" cy="38.5" rx="3.5" ry="5" fill="${FT}" stroke="none"/>`
  ),

  // ── I  Solo meñique extendido
  I: wrap(pm + wr + fu(18)),

  // ── J  Meñique + trayectoria en J (baja → gira a la derecha del observador)
  J: wrap(
    pm + wr + fu(18) +
    `<path d="M18,10 L18,44 Q12,54 16,58 Q22,60 26,52" ` +
    `fill="none" stroke="${C}" stroke-width="2" stroke-dasharray="4,3"/>`
  ),

  // ── K  Índice arriba, medio diagonal, pulgar entre ambos
  K: wrap(
    pm + wr +
    fu(54) +
    fuR(40, -22) +
    `<path d="M40,54 C38,49 40,44 45,43 Q51,42 53,47 C54,52 51,56 47,57 Z" ` +
    `fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── L  Índice arriba, pulgar horizontal
  L: wrap(pm + wr + fu(54) + tLeft),

  // ── M  Tres dedos sobre el pulgar
  M: wrap(pm + wr + fh(30) + fh(42) + fh(54) + tUnder),

  // ── N  Dos dedos sobre el pulgar
  N: wrap(pm + wr + fh(42) + fh(54) + tUnder),

  // ── O  Todos forman una O
  O: wrap(
    wr +
    `<ellipse cx="40" cy="46" rx="27" ry="35" fill="${FM}" stroke="${C}" stroke-width="2.8"/>` +
    `<ellipse cx="40" cy="46" rx="14" ry="22" fill="rgba(12,17,24,0.82)" stroke="${C}" stroke-width="1.8"/>`
  ),

  // ── P  Como K pero toda la mano inclinada hacia adelante/abajo
  P: wrap(
    pm + wr +
    fuR(54, 36) +
    fuR(40, 16) +
    `<path d="M40,58 C38,53 40,48 45,47 Q51,46 53,51 C54,56 51,60 47,61 Z" ` +
    `fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── Q  Como G pero apuntando hacia abajo
  Q: wrap(
    pm + wr +
    fuR(54, 30) +
    `<path d="M58,50 C62,54 64,64 60,72 Q56,80 50,80 Q44,80 42,72 C40,64 44,56 50,54 Z" ` +
    `fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── R  Índice y medio cruzados — medio sobre índice
  // Rotaciones invertidas: flip global invierte el signo, así los dedos se cruzan
  R: wrap(
    pm + wr +
    fuR(50, -8) +
    fuR(38, 8)
  ),

  // ── S  Puño con pulgar sobre los nudillos
  S: wrap(
    fist + wr +
    `<path d="M14,28 C18,25 50,23 60,24 Q66,25 66,30 Q65,36 58,37 L14,38 C9,38 8,35 8,32 C8,29 10,28 14,28 Z" ` +
    `fill="${FD}" stroke="${C}" stroke-width="${SW2}" transform="rotate(-2,37,33)"/>`
  ),

  // ── T  Pulgar entre índice y medio en puño cerrado
  T: wrap(
    fist + wr +
    `<path d="M37,28 C35,24 37,18 42,16 Q48,14 52,18 Q56,22 54,30 C52,36 46,40 42,38 C38,36 37,32 37,28 Z" ` +
    `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="50" cy="17" rx="4.5" ry="3" fill="${FT}" stroke="none" transform="rotate(-8,50,17)"/>`
  ),

  // ── U  Índice y medio juntos hacia arriba
  U: wrap(pm + wr + fu(42) + fu(54)),

  // ── V  Índice y medio en V abierta
  V: wrap(
    pm + wr +
    fuR(40, -14) +
    fuR(54, 14)
  ),

  // ── W  Tres dedos en abanico
  W: wrap(
    pm + wr +
    fuR(26, -13) +
    fu(40) +
    fuR(54, 13)
  ),

  // ── X  Índice en gancho
  X: wrap(
    pm + wr +
    `<path d="M48,62 C47,58 47,52 50,47 Q54,42 59,44 Q64,47 62,54 C60,60 56,64 52,65 Z" ` +
    `fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="59" cy="44" rx="4.5" ry="3" fill="${FT}" stroke="none" transform="rotate(24,59,44)"/>`
  ),

  // ── Y  Meñique y pulgar extendidos
  Y: wrap(pm + wr + fu(18) + tOut),

  // ── Z  Índice traza Z en el aire
  Z: wrap(
    pm + wr + fu(54) +
    `<line x1="50" y1="9"  x2="72" y2="9"  stroke="${C}" stroke-width="2.4"/>` +
    `<line x1="72" y1="9"  x2="50" y2="31" stroke="${C}" stroke-width="2.4"/>` +
    `<line x1="50" y1="31" x2="72" y2="31" stroke="${C}" stroke-width="2.4"/>`
  ),
}

export const signURI = (letter: string): string => {
  const s = SIGNS[letter]
  return s ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}` : ''
}
