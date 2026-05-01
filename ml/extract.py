"""
ml/extract.py — Extracción de landmarks ASL con MediaPipe.

Uso:
    python -m ml.extract
    python ml/extract.py          (también funciona desde la raíz del proyecto)

Salida: lsc_master.csv  (o YOSO_OUTPUT_CSV env var)
"""

import sys
import os

# Permite ejecutar directamente: python ml/extract.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cv2
import mediapipe as mp
import pandas as pd
import numpy as np
import concurrent.futures

from ml.config import (
    DATA_ROOTS, OUTPUT_CSV, CPU_WORKERS,
    VALID_CLASSES, KEYWORDS, CARPETAS_EXCLUIDAS, ALFABETO, COLS_CSV,
)
from ml.features import recalibrar, construir_features


# ── Worker de MediaPipe ───────────────────────────────────────────────────
# Las funciones deben ser module-level para que ProcessPoolExecutor pueda
# serializarlas en los procesos hijo (spawn en Windows).

_hands: mp.solutions.hands.Hands | None = None


def _iniciar_worker() -> None:
    global _hands
    _hands = mp.solutions.hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.5,
    )


def _procesar_imagen(tarea: tuple[str, str]) -> list | None:
    path, label = tarea
    try:
        img = cv2.imread(path)
        if img is None:
            return None

        res = _hands.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        if not res.multi_hand_landmarks:
            return None

        pts = np.array(
            [[lm.x, lm.y] for lm in res.multi_hand_landmarks[0].landmark],
            dtype=np.float32,
        )

        resultado = recalibrar(pts.flatten())
        if resultado is None:
            return None

        coords_norm, angulo = resultado
        feat = construir_features(coords_norm, angulo)
        return [label] + feat.tolist()

    except Exception:
        return None


# ── Detección de clase por ruta ───────────────────────────────────────────

def _extraer_clase(ruta_archivo: str, ruta_base: str) -> str | None:
    try:
        rel     = os.path.relpath(ruta_archivo, ruta_base)
        carpeta = rel.split(os.sep)[0].lower().strip()

        if carpeta in VALID_CLASSES:
            return carpeta
        if carpeta in KEYWORDS:
            return KEYWORDS[carpeta]
        if (len(carpeta) > 1
                and carpeta[0] in ALFABETO
                and carpeta not in CARPETAS_EXCLUIDAS):
            return carpeta[0]
    except Exception:
        pass
    return None


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> None:
    sep = '=' * 55
    print(sep)
    print('YOSO — Extracción de landmarks')
    print(f'Workers: {CPU_WORKERS}  |  Salida: {OUTPUT_CSV}')
    print(sep)

    tareas: list[tuple[str, str]] = []
    conteo: dict[str, int] = {c: 0 for c in sorted(VALID_CLASSES)}

    for base in DATA_ROOTS:
        if not os.path.exists(base):
            print(f'  [AVISO] Ruta no encontrada: {base}')
            continue

        print(f'  Escaneando: {base}')
        for root, _, files in os.walk(base):
            for f in files:
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    full  = os.path.join(root, f)
                    label = _extraer_clase(full, base)
                    if label:
                        tareas.append((full, label))
                        conteo[label] += 1

    total = len(tareas)
    if total == 0:
        print('ERROR: No se encontraron imágenes válidas.')
        return

    print(f'\n  Imágenes localizadas: {total:,}')
    print('-' * 40)
    for c in sorted(conteo):
        if conteo[c]:
            print(f'  {c.upper():<8}: {conteo[c]:>6,}')
    print('-' * 40)

    print(f'\nExtrayendo landmarks con {CPU_WORKERS} workers...\n')
    muestras:   list[list] = []
    procesados: int        = 0

    with concurrent.futures.ProcessPoolExecutor(
        max_workers=CPU_WORKERS, initializer=_iniciar_worker
    ) as ex:
        for resultado in ex.map(_procesar_imagen, tareas, chunksize=200):
            procesados += 1
            if resultado is not None:
                muestras.append(resultado)
            if procesados % 2000 == 0 or procesados == total:
                pct = procesados / total * 100
                print(
                    f'  [{procesados:>6}/{total}]  {pct:5.1f}%  '
                    f'válidas: {len(muestras):>6}',
                    end='\r',
                )

    print(f'\n\n  Muestras con mano detectada: {len(muestras):,} '
          f'({len(muestras) / total * 100:.1f}% del total)')

    print(f'\nGuardando {OUTPUT_CSV}...')

    # Las features tienen 48 columnas; COLS_CSV espera label + 42 coords + ángulo.
    # Guardamos label + los 48 features con nombres extendidos.
    cols = ['label'] + [f'f{i}' for i in range(48)]
    pd.DataFrame(muestras, columns=cols).to_csv(OUTPUT_CSV, index=False)
    print(f'¡Listo! → {OUTPUT_CSV}')


if __name__ == '__main__':
    main()
