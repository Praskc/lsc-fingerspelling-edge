<div align="center">

# YOSO — You Only Sign Once

**Motor de reconocimiento de Lengua de Señas Colombiana (LSC) en tiempo real**  
*Inferencia edge · Sin servidor · < 10ms de latencia*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-Web-FF6F00?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision_0.10.35-00897B?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
[![License](https://img.shields.io/badge/Licencia-GPL_2.0-blue?style=flat-square)](LICENSE)

</div>

## ¿Qué es YOSO?

YOSO es un sistema completo de reconocimiento del alfabeto dactilológico de la **Lengua de Señas Colombiana (LSC)** que corre **100% en el navegador**, sin servidor, sin conexión a internet y con latencia de inferencia menor a 10ms.

El sistema fue desarrollado con el propósito de reducir las barreras de comunicación de la comunidad sorda colombiana, utilizando tecnología de edge computing accesible desde cualquier dispositivo con cámara y navegador, sin necesidad de infraestructura costosa.

> **Estado actual:** El modelo base fue entrenado con datos ASL como prueba de concepto. La migración completa a LSC está en progreso con dataset propio recolectado con la comunidad sorda colombiana en colaboración con intérpretes certificados de LSC.

## Pipeline completo

```
Cámara → MediaPipe Tasks-Vision (hand_landmarker) → 21 landmarks → 48 features → FCNN ONNX → Buffer de votación → Letra confirmada
```

### Arquitectura del modelo

```
Input(48) → Linear(512) → ReLU → Dropout(0.35)   ┐
          → Linear(512) → ReLU → Dropout(0.30)   ├─ Bloques residuales con BatchNorm + shortcut
          → Linear(256) → ReLU → Dropout(0.20)   │
          → Linear(128) → ReLU → Dropout(0.20)   ┘
          → Linear(28)  → Softmax
```

| Métrica | Valor |
|---------|-------|
| Clases | 28 (A-Z + SPACE + DELETE) |
| Muestras de entrenamiento | ~360.000 |
| Accuracy en test | **98.63%** |
| Early stopping | Epoch 85 |
| Latencia de inferencia | **< 10ms** |
| Tamaño del modelo ONNX | ~2.4 MB |

## Feature Engineering — 48 features

| Features | Descripción |
|----------|-------------|
| 42 coords | x,y × 21 landmarks normalizados anatómicamente |
| 1 ángulo global | `atan2(y₉, x₉)` — orientación de la palma |
| 5 distancias | Norma euclidiana punta→muñeca por dedo (landmarks 4, 8, 12, 16, 20) |

**Normalización anatómica:**
1. Traslación al origen desde la muñeca (landmark 0)
2. Escala fija por distancia muñeca→nudillo medio (landmark 9) — invariante a distancia cámara-mano
3. Flip del eje X para mano izquierda — invarianza de lateralidad, ambidiestro por diseño

## Motor de inferencia

### Filtros de validación en cadena

```
Red neuronal → Softmax estable → Juez U/R → Filtro zona gris → Buffer votación → Letra confirmada
```

**Juez U/R** — discriminación geométrica entre U y R por posición relativa de landmarks 8 y 12 (cruce de dedos índice y corazón)

**Filtro zona gris** — entre 55% y 75% de confianza aplica penalización suave por distancia al centroide de clase. Por encima del 75% no penaliza para no rechazar señas válidas con alta confianza

**dist_ref por clase** — P75 de distancias intra-clase calculado sobre el training set. M y N tienen dist_ref 5-6× más altas que el resto por la alta varianza que genera la oclusión de dedos superpuestos

**Buffer de votación ponderado** — acumula pesos por frame, requiere peso mínimo equivalente a 5 votos sobre umbral para confirmar. Elimina detecciones espurias sin necesitar bajar la mano entre letras

**Cooldown por tipo:**
| Tipo | Cooldown |
|------|----------|
| Letra distinta | 800 ms |
| Misma letra (mantener seña) | 1800 ms |
| SPACE / DELETE | 400 ms |

**Escudo cinético** — SPACE y DELETE requieren jitter < 0.02 para evitar activación accidental por movimiento

## Pipeline de entrenamiento

### Preprocesado en `ml/train.py`

1. Recalibración anatómica forzada en cada fila — idempotente, si ya está normalizado no cambia nada
2. Ángulo global calculado on-the-fly
3. Split estratificado 85/15 con stratify por clase
4. **Limpieza de outliers IQR×3.0** solo sobre train set — elimina frames donde MediaPipe trackea mal
5. Centroides calculados **después** de la limpieza y **solo sobre train** — sin data leakage

### Hiperparámetros

| Parámetro | Valor |
|-----------|-------|
| Optimizador | AdamW (lr=0.001, weight_decay=0.01) |
| Scheduler | CosineAnnealingWarmRestarts (T₀=10) |
| Loss | CrossEntropyLoss con pesos de clase |
| Augmentation | Ruido gaussiano + rotación ±20° + escala 0.88–1.12 |
| Early stopping | patience=15 sobre accuracy de test |

### Diagnóstico automático

`ml/train.py` verifica que la normalización fue correcta antes de entrenar:
- `x̄_muñ ≈ 0` y `ȳ_muñ ≈ 0` → muñeca en el origen ✓
- `‖p9‖ ≈ 1.000` → escala anatómica aplicada ✓

### Datasets

| Dataset | Autor | Licencia | Muestras | Uso |
|---------|-------|----------|----------|-----|
| [ASL Alphabet](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) | Akash (grassknoted) | GPL 2.0 | 87.000 | Base de entrenamiento |
| [ASL Alphabet Dataset](https://www.kaggle.com/datasets/debashishsau/aslamerican-sign-language-aplhabet-dataset) | Debashish Sau | CC0 | ~270.000 | Base de entrenamiento |
| Dataset LSC propio | Comunidad sorda colombiana | — | En recolección | Fine-tuning LSC |

## Diferencias LSC vs ASL

El alfabeto manual colombiano tiene **32 configuraciones** para las 27 letras del español. Las principales diferencias con ASL relevantes para el modelo:

| Letra | Tipo | Nota |
|-------|------|------|
| **F** | Estática diferente | Reentrenar con datos LSC |
| **G** | Con movimiento | Configuración y movimiento distintos |
| **J** | Con movimiento | Trayectoria similar a ASL |
| **P** | Estática diferente | Reentrenar con datos LSC |
| **Q** | Estática diferente | Reentrenar con datos LSC |
| **S** | Con movimiento | Rotación de muñeca |
| **U** | Estática diferente | Reentrenar con datos LSC |
| **Z** | Con movimiento | Traza la Z en el aire |
| **Ñ** | Con movimiento | No existe en ASL — clase nueva |

Las 5 letras con movimiento (G, J, S, Z, Ñ) serán manejadas por una **rama GRU** ligera separada de la FCNN principal, diseñada para deployment en ESP32-S3.

## Features de la aplicación

| Feature | Descripción |
|---------|-------------|
| **Traductor en tiempo real** | Concatenación con cooldown de 800ms, soporte SPACE y DELETE |
| **Motor de gamificación** | 5 niveles de dificultad, banco local de 300 palabras en español sin dependencia externa |
| **Modo aprendizaje** | Grid del alfabeto interactivo, la seña detectada se ilumina en tiempo real |
| **ROI adaptativo** | Región de interés sincronizada con límites de detección |
| **PWA instalable** | Funciona offline, carga instantánea, service worker cache-first |
| **Onboarding** | Tutorial de primera visita, solo se muestra una vez (localStorage) |
| **Errores de cámara** | Mensajes por tipo (NotAllowedError, NotFoundError, NotReadableError) con reintento |
| **Detección de luminosidad** | Muestreo de 576 px cada ~3 s, aviso si el entorno está oscuro |
| **Pausa automática** | Page Visibility API pausa la inferencia cuando la pestaña está oculta |
| **Panel de debug** | Confianza, distancia a centroide, buffer, top-3, RAM heap, MP frame y FPS |

## Estructura del proyecto

```
├── src/
│   ├── core/
│   │   ├── app.ts          # Orquestador — pipeline Tasks-Vision, ROI, visibilidad, luminosidad
│   │   └── main.ts         # Entry point + registro del Service Worker
│   ├── engine/
│   │   ├── inference.ts    # Motor de IA — preprocesado, softmax, filtros, buffer de votos
│   │   └── types.ts        # Interfaces TypeScript del motor
│   ├── game/
│   │   └── game.ts         # Motor de gamificación — palabras por niveles, banco local 300 palabras
│   ├── lib/
│   │   └── signs.ts        # Diagramas SVG orgánicos del alfabeto (perspectiva observador)
│   ├── ui/
│   │   ├── hud.ts          # HUD de predicción y estado de mano
│   │   ├── debug.ts        # Panel de debug — métricas, buffer, top-3
│   │   ├── splash.ts       # Pantalla de carga
│   │   ├── toast.ts        # Notificaciones no intrusivas
│   │   ├── learn.ts        # Modo aprendizaje — grid del alfabeto
│   │   ├── onboarding.ts   # Tutorial de primera visita
│   │   └── index.ts        # Re-exporta RenderizadorUI
│   └── styles.css          # UI fluid con CSS custom properties + container queries
├── public/
│   ├── YOSO.onnx           # Modelo exportado (2.4 MB)
│   ├── Centroides.json     # Centroides + dist_ref P75 por clase
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker — cache-first CDN + Google Storage, network-first navegación
│   ├── robots.txt          # Directivas para crawlers
│   └── favicon.svg         # Ícono de la app
├── ml/
│   ├── extract.py          # Extractor de landmarks desde imágenes del dataset
│   ├── train.py            # Entrenamiento, limpieza IQR, exportación ONNX
│   ├── features.py         # Feature engineering compartido
│   ├── config.py           # Configuración del pipeline ML
│   └── model/              # Salida del entrenamiento (ONNX + JSON) — no versionado
├── docker/
│   ├── Dockerfile          # Multi-stage: node:22-alpine builder → nginx:1.27-alpine runtime
│   ├── compose.yaml        # Docker Compose — puerto 8080
│   └── nginx.conf          # Caché diferenciada, COOP/COEP, CSP completa, gzip
├── index.html              # HTML principal
├── vite.config.ts          # Headers COOP/COEP para SharedArrayBuffer (WASM threads) en dev/preview
├── vercel.json             # Headers de seguridad completos (COOP/COEP/CSP) para Vercel
└── tsconfig.json           # TypeScript strict mode
```

## Instalación y uso

### Requisitos

- Node.js 18+ y pnpm

```bash
git clone https://github.com/Praskc/Motor-de-inferencia-web-ASL-usando-mediapipe-landmarks-y-edge-computing.git
cd Motor-de-inferencia-web-ASL-usando-mediapipe-landmarks-y-edge-computing
git checkout refactor
pnpm install
pnpm dev
```

Abre `http://localhost:5173` y permite acceso a la cámara.

### Entrenamiento

```bash
pip install torch torchvision pandas numpy scikit-learn onnx

# Extraer features desde imágenes
python ml/extract.py

# Entrenar — exporta YOSO.onnx y Centroides.json a ml/model/
python ml/train.py

# Copiar al directorio public para que Vite los sirva
cp ml/model/YOSO.onnx public/
cp ml/model/Centroides.json public/
```

> **Consistencia crítica:** `ml/extract.py`, `ml/train.py` e `src/inference.ts` implementan el mismo pipeline de normalización anatómica. Cualquier cambio debe aplicarse en los tres.

## Despliegue

### Vercel

Listo para desplegar sin configuración adicional. `vercel.json` configura los headers COOP/COEP necesarios para ONNX Runtime WASM con multithreading.

```bash
pnpm run build
# Conectar el repositorio en vercel.com — detección automática de Vite
```

### Docker

Build multi-stage: construye con Node 22 Alpine y sirve con nginx 1.27 Alpine. La imagen final pesa ~25 MB.

```bash
docker compose up --build          # Levanta en http://localhost:8080
docker compose up --build -d       # En segundo plano
```

El `nginx.conf` incluido gestiona caché diferenciada (assets con hash `immutable`, modelo 7 días, SW sin caché) y envía los headers COOP/COEP en todas las rutas.

## Notas técnicas

**Lateralidad MediaPipe Tasks-Vision** — A diferencia de la API legacy, Tasks-Vision 0.10.35 etiqueta la mano derecha física como `'Right'`. El flip de eje X se aplica cuando `handedness.label === 'Left'` (mano izquierda física vista en espejo)

**M y N** — son las clases con mayor varianza intra-clase por oclusión de dedos superpuestos. Sus dist_ref son 5-6× más altas que el resto

**SharedArrayBuffer** — ONNX Runtime WASM con `intraOpNumThreads: 2` requiere los headers `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`. Configurados en `vite.config.ts` (dev/preview), `vercel.json` (producción Vercel) y `docker/nginx.conf` (Docker)

**Service Worker y modelo ONNX** — el modelo (2.4 MB) se precachea en la instalación del SW. Tras la primera carga la app funciona completamente offline

## Ramas

| Rama | Descripción |
|------|-------------|
| `main` | Legacy — JavaScript vanilla, arquitectura original v1 |
| `refactor` | Actual — TypeScript strict, arquitectura modular, MediaPipe Tasks-Vision, PWA, CSP completa |

## Changelog

### v3 — refactor (actual)
Modularización de `src/` en `core/`, `engine/`, `game/`, `lib/` y `ui/`. Migración a `@mediapipe/tasks-vision@0.10.35` con fix de lateralidad. CSP completa en Vercel y Docker. Service worker `yoso-v6` con cache de Google Storage. Panel de debug extendido con MP frame y FPS. `compose.yaml` movido a `docker/`.

### v2 — refactor
Migración a TypeScript strict. PWA instalable y funcional offline. Gamificación con banco local de 300 palabras. Modo aprendizaje con grid interactivo. Buffer de votación ponderado. ROI adaptativo. Detección de luminosidad. Panel de debug. Deploy en Vercel y Docker.

### v1 — main (legacy)
JavaScript vanilla. Pipeline de 48 features con normalización anatómica. Filtro zona gris con dist_ref P75. Dataset ~360k muestras, 98.63% accuracy.

## Roadmap

### En progreso
- [ ] Recolección dataset LSC — 35 personas, 28 clases, colaboración con intérpretes certificados
- [ ] Fine-tuning FCNN para 8 clases estáticas distintas entre ASL y LSC
- [ ] GRU unidireccional para 5 letras con movimiento (J, Ñ, S, G, Z)

### Siguiente fase
- [ ] Cuantización INT8 para deployment en ESP32-S3 — TinyML edge
- [ ] Panel de referencia visual con todas las señas LSC
- [ ] Coordenada Z de MediaPipe en extracción de features — reduce falsos positivos por oclusión
- [ ] Features de curvatura e ángulos inter-dedo para M/N/E/S

## Contexto

Este proyecto nace en **Sucre, Colombia**. El reconocimiento de lengua de señas es un derecho de comunicación, no un producto — por ende YOSO es y será siempre open source, desarrollado en colaboración con la comunidad sorda colombiana de la universidad de Sucre.

## Autor

**Esteban Cotera** — Estudiante de Ingeniería electrónica, Sucre, Colombia


</div>
