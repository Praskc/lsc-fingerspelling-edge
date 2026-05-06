

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import time
import random

import numpy as np
import pandas as pd
import torch
from torch import nn
import torch.nn.init as init
from torch.utils.data import DataLoader, Dataset
from sklearn.model_selection import train_test_split

from ml.config import (
    N_FEATURES, N_CLASES, LABEL_TO_INDEX, INDEX_TO_LABEL,
    CSV_FILES, MAX_EPOCHS, PATIENCE, BATCH_SIZE, LR, WEIGHT_DECAY,
    ONNX_PATH, CENTROIDS_PATH, PTH_PATH,
)
from ml.features import recalibrar_batch, construir_features_batch

device = 'cuda' if torch.cuda.is_available() else 'cpu'


def log(msg: str) -> None:
    print(f'[{time.strftime("%H:%M:%S")}] {msg}')




def normalizar_label(lbl: str) -> str:
    lbl = lbl.strip().lower()
    if lbl in LABEL_TO_INDEX:
        return lbl
    for sep in ('_', '-', ' '):
        for parte in reversed(lbl.split(sep)):
            if parte in LABEL_TO_INDEX:
                return parte
    if lbl and lbl[0] in LABEL_TO_INDEX:
        return lbl[0]
    return lbl



def _diagnostico_dataset(
    X: np.ndarray, y: np.ndarray, nombre: str, tiene_angulo: bool
) -> None:
    sep = '─' * 72
    log(sep)
    log(f'  DIAGNÓSTICO: {nombre}')
    log(f'  ángulo {"incluido en CSV" if tiene_angulo else "calculado on-the-fly"}')
    log(f'  {"Clase":>6}  {"n":>6}  {"x̄_muñ":>8}  {"ȳ_muñ":>8}  {"‖p9‖":>7}  {"dmax":>7}')
    log(f'  {"─"*6}  {"─"*6}  {"─"*8}  {"─"*8}  {"─"*7}  {"─"*7}')

    for idx in sorted(np.unique(y)):
        nombre_clase = INDEX_TO_LABEL[int(idx)]
        samples = X[y == idx]
        pts     = samples[:, :42].reshape(-1, 21, 2)

        x_mun   = pts[:, 0, 0].mean()
        y_mun   = pts[:, 0, 1].mean()
        norm_p9 = np.linalg.norm(pts[:, 9, :], axis=1).mean()
        dmax    = np.linalg.norm(pts, axis=2).max()

        ok   = abs(x_mun) < 0.01 and abs(y_mun) < 0.01 and abs(norm_p9 - 1.0) < 0.05
        flag = '' if ok else '  ← REVISAR'
        log(
            f'  {nombre_clase.upper():>6}  {len(samples):>6,}  '
            f'{x_mun:>+8.4f}  {y_mun:>+8.4f}  '
            f'{norm_p9:>7.4f}  {dmax:>7.4f}{flag}'
        )
    log(sep)


def cargar_y_unificar(csv_files: list[str]) -> tuple[np.ndarray, np.ndarray]:
    todos_feats:  list[np.ndarray] = []
    todos_labels: list[np.ndarray] = []

    for fname in csv_files:
        if not os.path.exists(fname):
            log(f'  [SKIP] {fname} no encontrado')
            continue

        df = pd.read_csv(fname)
        log(f'  Leyendo {fname}: {len(df):,} filas  {len(df.columns)} cols')

        df.iloc[:, 0] = df.iloc[:, 0].astype(str).apply(normalizar_label)
        df = df[df.iloc[:, 0].isin(LABEL_TO_INDEX)].reset_index(drop=True)
        if df.empty:
            continue

        tiene_angulo = len(df.columns) >= 44
        coords_raw   = df.iloc[:, 1:43].values.astype(np.float32)   # (N, 42)
        labels_raw   = df.iloc[:, 0].values

        # ── Recalibración vectorizada ──────────────────────────────────────
        pts_batch, angles_calc, valid = recalibrar_batch(coords_raw)

        if tiene_angulo:
            angles_csv = pd.to_numeric(
                df.iloc[:, 43], errors='coerce'
            ).values.astype(np.float32)
            nan_mask = np.isnan(angles_csv)
            angles_csv[nan_mask] = angles_calc[nan_mask]
            angles_final = angles_csv
        else:
            angles_final = angles_calc

        feats  = construir_features_batch(pts_batch[valid], angles_final[valid])
        labels = np.array(
            [LABEL_TO_INDEX[l] for l in labels_raw[valid]], dtype=np.int64
        )

        log(f'    → {int(valid.sum()):,} filas válidas de {len(df):,}')
        _diagnostico_dataset(feats, labels, fname, tiene_angulo)

        todos_feats.append(feats)
        todos_labels.append(labels)

    if not todos_feats:
        raise RuntimeError('No se cargaron muestras. Verifica los CSV.')

    X = np.concatenate(todos_feats, axis=0)
    y = np.concatenate(todos_labels, axis=0)
    log(f'  Total unificado: {len(X):,}  X.shape={X.shape}')
    return X, y


# ── Centroides P75 ────────────────────────────────────────────────────────

def calcular_centroides(X_tr: np.ndarray, y_tr: np.ndarray) -> dict:
    log('Calculando centroides (P75) sobre train set...')
    centroides = {}
    for idx in sorted(np.unique(y_tr)):
        nombre  = INDEX_TO_LABEL[int(idx)]
        samples = X_tr[y_tr == idx]
        centro  = samples.mean(axis=0)
        dists   = np.linalg.norm(samples - centro, axis=1)
        p25, p50, p75 = np.percentile(dists, [25, 50, 75])
        centroides[nombre] = {
            'coords':   centro.tolist(),
            'dist_ref': round(float(p75), 4),
        }
        log(f'  [{nombre:>6}] n={len(samples):>6,}  '
            f'P25={p25:.3f}  P50={p50:.3f}  P75={p75:.3f}')
    return centroides




def limpiar_outliers_train(
    X_tr: np.ndarray, y_tr: np.ndarray, factor_iqr: float = 3.0
) -> tuple[np.ndarray, np.ndarray]:
    mascara = np.ones(len(X_tr), dtype=bool)

    for idx in sorted(np.unique(y_tr)):
        sel   = y_tr == idx
        norms = np.linalg.norm(X_tr[sel], axis=1)
        q1, q3 = np.percentile(norms, [25, 75])
        limite  = q3 + factor_iqr * (q3 - q1)
        out_idx = np.where(sel)[0][norms > limite]
        mascara[out_idx] = False
        if len(out_idx):
            log(f'  [{INDEX_TO_LABEL[int(idx)]:>6}] -{len(out_idx):<4} outliers  límite={limite:.2f}')

    X_c, y_c   = X_tr[mascara], y_tr[mascara]
    eliminadas = len(X_tr) - len(X_c)
    log(f'Limpieza IQR×{factor_iqr}: -{eliminadas:,} de {len(X_tr):,} '
        f'({100 * eliminadas / len(X_tr):.2f}%)')
    return X_c, y_c


# ── Dataset con augmentation ──────────────────────────────────────────────

class SignDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray, augment: bool = False):
        self.X       = X.astype(np.float32)
        self.y       = y.astype(np.int64)
        self.augment = augment

    def __len__(self) -> int:
        return len(self.y)

    @staticmethod
    def _aug(x: np.ndarray) -> np.ndarray:
        x = x.copy()
        x[:42] += np.random.normal(0, 0.008, 42).astype(np.float32)

        a = np.radians(random.uniform(-20, 20))
        c, s = np.cos(a), np.sin(a)
        coords = x[:42].reshape(21, 2)
        rotated = coords @ np.array([[c, s], [-s, c]], dtype=np.float32)
        x[:42] = rotated.flatten()
        x[42] = float(x[42]) + a

        sc      = random.uniform(0.88, 1.12)
        x[:42] *= sc
        x[43:] *= sc

        if random.random() > 0.65:
            x[:10] += np.random.normal(0, 0.018, 10).astype(np.float32)
        return x

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        x = self.X[idx]
        if self.augment and random.random() > 0.45:
            x = self._aug(x)
        return torch.from_numpy(x), torch.tensor(self.y[idx])


# ── Arquitectura ──────────────────────────────────────────────────────────

class ResidualBlock(nn.Module):
    def __init__(self, in_f: int, out_f: int, dropout: float = 0.3):
        super().__init__()
        self.fc       = nn.Linear(in_f, out_f)
        self.bn       = nn.BatchNorm1d(out_f)
        self.act      = nn.LeakyReLU(0.01, inplace=True)
        self.drop     = nn.Dropout(dropout)
        self.shortcut = (
            nn.Sequential(nn.Linear(in_f, out_f, bias=False), nn.BatchNorm1d(out_f))
            if in_f != out_f else nn.Identity()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.drop(self.act(self.bn(self.fc(x)))) + self.shortcut(x)


class FCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(N_FEATURES, 512),
            nn.BatchNorm1d(512),
            nn.LeakyReLU(0.01, inplace=True),
            ResidualBlock(512, 512, dropout=0.35),
            ResidualBlock(512, 256, dropout=0.30),
            ResidualBlock(256, 128, dropout=0.20),
            nn.Linear(128, N_CLASES),
        )
        for m in self.modules():
            if isinstance(m, nn.Linear):
                init.kaiming_normal_(m.weight, a=0.01, nonlinearity='leaky_relu')
                if m.bias is not None:
                    init.constant_(m.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Loops de entrenamiento/evaluación ────────────────────────────────────

def train_epoch(
    loader: DataLoader, model: nn.Module, loss_fn: nn.Module, optimizer: torch.optim.Optimizer
) -> float:
    model.train()
    total = 0.0
    for Xb, yb in loader:
        Xb, yb = Xb.to(device), yb.to(device)
        optimizer.zero_grad(set_to_none=True)          # más rápido que zero_grad()
        loss = loss_fn(model(Xb), yb)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total += loss.item()
    return total / len(loader)


def eval_epoch(
    loader: DataLoader, model: nn.Module, loss_fn: nn.Module
) -> tuple[float, float]:
    """Devuelve (accuracy %, val_loss)."""
    model.eval()
    correct, val_loss = 0, 0.0
    with torch.no_grad():
        for Xb, yb in loader:
            Xb, yb    = Xb.to(device), yb.to(device)
            logits    = model(Xb)
            val_loss += loss_fn(logits, yb).item()
            correct  += (logits.argmax(1) == yb).sum().item()
    return (100.0 * correct / len(loader.dataset), val_loss / len(loader))  # type: ignore[arg-type]


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> None:
    os.makedirs(os.path.dirname(PTH_PATH) or '.', exist_ok=True)

    sep = '─' * 65
    log(sep)
    log(f'YOSO  |  device={device.upper()}  features={N_FEATURES}  clases={N_CLASES}')
    log(sep)

    log('Cargando datasets...')
    X, y = cargar_y_unificar(CSV_FILES)

    log('Distribución por clase:')
    for idx in sorted(np.unique(y)):
        log(f'  [{INDEX_TO_LABEL[idx]:>6}] {(y == idx).sum():>7,}')

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.15, stratify=y, random_state=42
    )
    log(f'Train: {len(X_tr):,}  |  Test: {len(X_te):,}')

    X_tr, y_tr = limpiar_outliers_train(X_tr, y_tr, factor_iqr=3.0)
    log(f'Train limpio: {len(X_tr):,}  |  Test (intacto): {len(X_te):,}')

    centroides = calcular_centroides(X_tr, y_tr)
    with open(CENTROIDS_PATH, 'w', encoding='utf-8') as f:
        json.dump(centroides, f, indent=2, ensure_ascii=False)
    log(f'{CENTROIDS_PATH} guardado.')

    counts        = np.bincount(y_tr, minlength=N_CLASES).astype(np.float32)
    counts        = np.where(counts == 0, 1.0, counts)
    class_weights = torch.tensor(
        len(y_tr) / (N_CLASES * counts), dtype=torch.float32
    ).to(device)

    nw  = 4 if device == 'cuda' else 0
    pin = device == 'cuda'
    train_loader = DataLoader(
        SignDataset(X_tr, y_tr, augment=True),
        batch_size=BATCH_SIZE, shuffle=True, num_workers=nw, pin_memory=pin,
    )
    test_loader = DataLoader(
        SignDataset(X_te, y_te, augment=False),
        batch_size=BATCH_SIZE, shuffle=False, num_workers=nw, pin_memory=pin,
    )

    model     = FCNN().to(device)
    loss_fn   = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
        optimizer, T_0=10, T_mult=1, eta_min=1e-5
    )

    # torch.compile acelera ~20-30% en PyTorch ≥2.0 con GPU
    try:
        model = torch.compile(model)  # type: ignore[assignment]
        log('torch.compile activado.')
    except Exception:
        pass

    best_acc = 0.0
    no_imp   = 0

    log(sep)
    log(f'  {"Ep":>4}  {"TrLoss":>8}  {"ValLoss":>8}  {"Acc":>7}  {"LR":>10}  Estado')
    log(sep)

    for epoch in range(1, MAX_EPOCHS + 1):
        tr_loss       = train_epoch(train_loader, model, loss_fn, optimizer)
        acc, val_loss = eval_epoch(test_loader, model, loss_fn)
        scheduler.step()
        lr = optimizer.param_groups[0]['lr']

        if acc > best_acc:
            best_acc = acc
            no_imp   = 0
            torch.save(model.state_dict(), PTH_PATH)
            estado = ' MEJOR'
        else:
            no_imp += 1
            estado  = f'  ({no_imp}/{PATIENCE})'

        log(f'  {epoch:>4}  {tr_loss:>8.4f}  {val_loss:>8.4f}  {acc:>6.2f}%  {lr:>10.6f}  {estado}')

        if no_imp >= PATIENCE:
            log(f'\nEarly stopping — {PATIENCE} épocas sin mejora.')
            break

    log(sep)
    log(f'Mejor accuracy: {best_acc:.2f}%')

    log('Exportando a ONNX...')
    state = torch.load(PTH_PATH, weights_only=True)
   
    if any(k.startswith('_orig_mod.') for k in state):
        state = {k.replace('_orig_mod.', ''): v for k, v in state.items()}
    export_model = FCNN().to(device)
    export_model.load_state_dict(state)
    export_model.eval()

    torch.onnx.export(
        export_model,
        torch.randn(1, N_FEATURES).to(device),
        ONNX_PATH,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
    )
    log(f'{ONNX_PATH} guardado. PROCESO COMPLETO.')


if __name__ == '__main__':
    main()
