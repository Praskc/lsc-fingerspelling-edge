// ============================================================================
// SIGNS.TS — Diagramas SVG del alfabeto ASL
// Obra original CC0 — posiciones de dedos basadas en ASL estándar
// ============================================================================

const C   = '#38BDF8'
const F   = 'rgba(56,189,248,0.46)'   // dedo extendido
const FT  = 'rgba(180,236,255,0.28)'  // punta / uña
const FM  = 'rgba(56,189,248,0.17)'   // palma
const FD  = 'rgba(56,189,248,0.07)'   // dedo doblado
const SW  = '2.2'
const SW2 = '1.6'

const wrap = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100">` +
  `<g stroke="${C}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">` +
  body + `</g></svg>`

// ── Formas base ──────────────────────────────────────────────────────────────

// Palma trapezoidal con crease sutil
const pm =
  `<path d="M10,60 L70,60 Q72,62 70,76 L64,88 L16,88 L10,76 Q8,62 10,60 Z" ` +
  `fill="${FM}" stroke="${C}" stroke-width="${SW2}"/>` +
  `<path d="M18,73 Q40,69 62,73" fill="none" stroke="rgba(56,189,248,0.16)" stroke-width="1.2"/>`

// Muñeca
const wr = `<rect x="20" y="84" width="40" height="13" rx="6" fill="${FM}" stroke="${C}" stroke-width="${SW2}"/>`

// Puño cerrado
const fist =
  `<path d="M10,34 L70,34 Q75,37 75,52 L75,74 Q75,88 62,90 L18,90 Q5,88 5,74 L5,52 Q5,37 10,34 Z" ` +
  `fill="${FM}" stroke="${C}" stroke-width="2"/>`

// Dedo extendido — cx: meñique=18, anular=30, medio=42, índice=54
const fu = (cx: number): string =>
  `<rect x="${cx - 6}" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
  `<ellipse cx="${cx}" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none"/>`

// Dedo doblado — stub en la base
const fh = (cx: number): string =>
  `<rect x="${cx - 5}" y="50" width="10" height="12" rx="5" fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`

// ── Pulgares ─────────────────────────────────────────────────────────────────

// Pulgar lateral derecho (A, Y)
const tOut =
  `<rect x="62" y="44" width="12" height="28" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" ` +
  `transform="rotate(28,68,58)"/>`

// Pulgar horizontal izquierdo (L)
const tLeft =
  `<rect x="5" y="62" width="28" height="11" rx="5.5" fill="${F}" stroke="${C}" stroke-width="${SW}"/>`

// Pulgar cruzando la palma (B)
const tIn =
  `<rect x="25" y="64" width="26" height="10" rx="5" fill="${F}" stroke="${C}" stroke-width="${SW2}"/>`

// Pulgar bajo los dedos (E, M, N)
const tUnder =
  `<rect x="28" y="70" width="16" height="7" rx="3.5" fill="${FD}" stroke="${C}" stroke-width="1.4"/>`

// ── 26 letras ────────────────────────────────────────────────────────────────

export const SIGNS: Record<string, string> = {

  // ── A  Puño, pulgar en el lateral
  A: wrap(fist + wr + tOut),

  // ── B  4 dedos extendidos juntos, pulgar cruzado
  B: wrap(pm + wr + fu(18) + fu(30) + fu(42) + fu(54) + tIn),

  // ── C  Mano curvada en arco abierto
  C: wrap(
    wr +
    `<path d="M66,16 A33,40 0 1,0 66,84" fill="${FM}" stroke="${C}" stroke-width="2.8"/>` +
    `<ellipse cx="64" cy="19" rx="5" ry="3.5" fill="${FT}" stroke="none"/>` +
    `<ellipse cx="64" cy="81" rx="5" ry="3.5" fill="${FT}" stroke="none"/>`
  ),

  // ── D  Índice arriba, otros dedos curvan hacia el pulgar
  D: wrap(
    pm + wr + fu(54) +
    `<path d="M52,14 Q24,20 14,44 Q12,62 28,68 Q42,72 52,65" ` +
    `fill="${FM}" stroke="${C}" stroke-width="2.2"/>`
  ),

  // ── E  Todos los dedos doblados, pulgar bajo
  E: wrap(pm + wr + fh(18) + fh(30) + fh(42) + fh(54) + tUnder),

  // ── F  Meñique/Anular/Medio arriba; Índice+Pulgar forman círculo OK
  F: wrap(
    pm + wr +
    fu(18) + fu(30) + fu(42) +
    `<circle cx="62" cy="38" r="12" fill="${FM}" stroke="${C}" stroke-width="2.2"/>` +
    `<circle cx="62" cy="38" r="5" fill="rgba(12,17,24,0.85)" stroke="${C}" stroke-width="1.8"/>`
  ),

  // ── G  Índice y pulgar apuntando horizontalmente a la derecha
  G: wrap(
    pm + wr +
    `<rect x="28" y="22" width="44" height="13" rx="6.5" fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="68" cy="28.5" rx="3.5" ry="5" fill="${FT}" stroke="none"/>` +
    `<rect x="28" y="40" width="30" height="11" rx="5.5" fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── H  Índice y medio horizontales paralelos
  H: wrap(
    pm + wr +
    `<rect x="10" y="20" width="52" height="13" rx="6.5" fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="58" cy="26.5" rx="3.5" ry="5" fill="${FT}" stroke="none"/>` +
    `<rect x="10" y="37" width="52" height="13" rx="6.5" fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="58" cy="43.5" rx="3.5" ry="5" fill="${FT}" stroke="none"/>`
  ),

  // ── I  Solo meñique extendido
  I: wrap(pm + wr + fu(18)),

  // ── J  Meñique + trayectoria en J
  J: wrap(
    pm + wr + fu(18) +
    `<path d="M18,10 Q32,0 42,10 Q48,18 42,28" ` +
    `fill="none" stroke="${C}" stroke-width="2" stroke-dasharray="4,3"/>`
  ),

  // ── K  Índice arriba, medio en ángulo, pulgar entre ambos
  K: wrap(
    pm + wr +
    `<rect x="47" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="53" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none"/>` +
    `<rect x="30" y="20" width="12" height="38" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(-22,36,39)"/>` +
    `<ellipse cx="34" cy="23" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(-22,36,39)"/>` +
    `<rect x="40" y="54" width="18" height="9" rx="4.5" fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── L  Índice arriba + pulgar horizontal izquierdo (forma L)
  L: wrap(pm + wr + fu(54) + tLeft),

  // ── M  Tres dedos doblados sobre el pulgar
  M: wrap(pm + wr + fh(30) + fh(42) + fh(54) + tUnder),

  // ── N  Dos dedos doblados sobre el pulgar
  N: wrap(pm + wr + fh(42) + fh(54) + tUnder),

  // ── O  Todos los dedos y pulgar forman una O
  O: wrap(
    wr +
    `<ellipse cx="40" cy="46" rx="27" ry="35" fill="${FM}" stroke="${C}" stroke-width="2.8"/>` +
    `<ellipse cx="40" cy="46" rx="14" ry="22" fill="rgba(12,17,24,0.82)" stroke="${C}" stroke-width="1.8"/>`
  ),

  // ── P  Como K pero inclinado hacia abajo/adelante
  P: wrap(
    pm + wr +
    `<rect x="47" y="26" width="12" height="44" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(36,53,48)"/>` +
    `<rect x="30" y="30" width="12" height="38" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(14,36,49)"/>` +
    `<rect x="40" y="52" width="18" height="9" rx="4.5" fill="${FD}" stroke="${C}" stroke-width="${SW2}"/>`
  ),

  // ── Q  Como G pero apuntando hacia abajo
  Q: wrap(
    pm + wr +
    `<rect x="24" y="42" width="44" height="13" rx="6.5" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(22,46,48.5)"/>` +
    `<rect x="24" y="58" width="30" height="11" rx="5.5" fill="${FD}" stroke="${C}" stroke-width="${SW2}" transform="rotate(22,39,63.5)"/>`
  ),

  // ── R  Índice y medio cruzados
  R: wrap(
    pm + wr +
    `<rect x="34" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(10,40,38)"/>` +
    `<ellipse cx="38" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(10,40,38)"/>` +
    `<rect x="48" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(-10,54,38)"/>` +
    `<ellipse cx="54" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(-10,54,38)"/>`
  ),

  // ── S  Puño, pulgar sobre los dedos
  S: wrap(
    fist + wr +
    `<rect x="18" y="26" width="38" height="11" rx="5.5" fill="${FD}" stroke="${C}" stroke-width="${SW2}" transform="rotate(-3,37,31.5)"/>`
  ),

  // ── T  Pulgar emerge entre índice y medio
  T: wrap(
    pm + wr +
    fh(18) + fh(30) + fh(42) + fh(54) +
    `<rect x="42" y="36" width="16" height="22" rx="7" fill="${F}" stroke="${C}" stroke-width="${SW}"/>` +
    `<ellipse cx="50" cy="39" rx="4.5" ry="2.8" fill="${FT}" stroke="none"/>`
  ),

  // ── U  Índice y medio juntos hacia arriba
  U: wrap(pm + wr + fu(42) + fu(54)),

  // ── V  Índice y medio en V abierta
  V: wrap(
    pm + wr +
    `<rect x="33" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(-13,39,38)"/>` +
    `<ellipse cx="37" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(-13,39,38)"/>` +
    `<rect x="49" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(13,55,38)"/>` +
    `<ellipse cx="55" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(13,55,38)"/>`
  ),

  // ── W  Tres dedos en abanico
  W: wrap(
    pm + wr +
    `<rect x="20" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(-15,26,38)"/>` +
    `<ellipse cx="24" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(-15,26,38)"/>` +
    fu(40) +
    `<rect x="48" y="14" width="12" height="48" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(15,54,38)"/>` +
    `<ellipse cx="54" cy="17" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(15,54,38)"/>`
  ),

  // ── X  Índice doblado en gancho
  X: wrap(
    pm + wr +
    `<rect x="47" y="24" width="12" height="34" rx="6" fill="${F}" stroke="${C}" stroke-width="${SW}" transform="rotate(26,53,41)"/>` +
    `<ellipse cx="51" cy="27" rx="3.5" ry="2.2" fill="${FT}" stroke="none" transform="rotate(26,53,41)"/>`
  ),

  // ── Y  Meñique y pulgar extendidos (shaka / hang loose)
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
