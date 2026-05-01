"""
Operaciones de feature engineering — versiones vectorizadas (batch) y escalares.

Las versiones batch procesan un array completo de una vez con numpy,
evitando bucles Python por muestra (x10-100× más rápido en datasets grandes).
Las versiones escalares se mantienen para el worker de MediaPipe.
"""

import numpy as np
from ml.config import PUNTAS


# ── Batch (vectorizado) ───────────────────────────────────────────────────

def recalibrar_batch(
    coords: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    (N, 42) float32 → pts (N, 21, 2), angles (N,), valid_mask (N,)

    - Traslada muñeca (pts[:,0]) al origen.
    - Normaliza ||pts[:,9]|| = 1 (distancia muñeca→palma).
    - Calcula ángulo global como arctan2(pts[:,9,1], pts[:,9,0]).
    - valid_mask=False donde la distancia palma ≈ 0 (mano degenerada).
    """
    pts = coords.reshape(-1, 21, 2).astype(np.float32)
    pts = pts - pts[:, 0:1, :]                                   # traslación

    norms = np.linalg.norm(pts[:, 9, :], axis=1)                 # (N,)
    valid = norms > 1e-6
    safe  = np.where(valid, norms, 1.0)
    pts   = pts / safe[:, np.newaxis, np.newaxis]                # normalización

    angles = np.arctan2(pts[:, 9, 1], pts[:, 9, 0])             # (N,)
    return pts, angles, valid


def construir_features_batch(pts: np.ndarray, angles: np.ndarray) -> np.ndarray:
    """
    (N, 21, 2), (N,) → (N, 48)
    Layout: [42 coords] + [1 ángulo] + [5 dist punta→muñeca]
    """
    coords_flat = pts.reshape(-1, 42)                            # (N, 42)
    dists       = np.linalg.norm(pts[:, PUNTAS, :], axis=2)     # (N, 5)
    return np.concatenate(
        [coords_flat, angles[:, np.newaxis], dists], axis=1
    ).astype(np.float32)


# ── Escalar (una muestra) ─────────────────────────────────────────────────

def recalibrar(coords_42: np.ndarray) -> tuple[np.ndarray, float] | None:
    """
    (42,) → (coords_norm (42,), angulo) ó None si mano degenerada.
    Usada en el worker de MediaPipe (ProcessPoolExecutor).
    """
    pts = coords_42.reshape(21, 2).astype(np.float32)
    pts -= pts[0]
    dist = np.linalg.norm(pts[9])
    if dist < 1e-6:
        return None
    pts /= dist
    return pts.flatten(), float(np.arctan2(pts[9, 1], pts[9, 0]))


def construir_features(coords_42: np.ndarray, angulo: float) -> np.ndarray:
    """(42,), float → (48,)"""
    pts   = coords_42.reshape(21, 2)
    dists = np.linalg.norm(pts[PUNTAS], axis=1).astype(np.float32)
    return np.concatenate([coords_42, [angulo], dists]).astype(np.float32)
