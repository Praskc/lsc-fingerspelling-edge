<div align="center">

# YOSO: You Only Sign Once

**Motor de reconocimiento de Lengua de Señas Colombiana (LSC) en tiempo real**  
*Inferencia edge · Sin servidor · < 10ms de latencia*

[![Branch: stable](https://img.shields.io/badge/branch-main_·_stable-2EA043?style=flat-square)](https://github.com/Praskc/lsc-fingerspelling-edge/tree/main)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-Web-FF6F00?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision_0.10.35-00897B?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
[![License](https://img.shields.io/badge/Licencia-GPL_2.0-blue?style=flat-square)](LICENSE)

</div>

> **Estás viendo la rama `main`, versión estable de producción.**
>
> Esta es la rama que despliega Vercel. Toda mejora aquí pasa primero por la rama `rolling` (auto-updates de dependencias) y se mergea manualmente tras validación. Versión actual: **v3.0**, ver [Changelog](#changelog) al final.
>
> | Rama | Propósito | Cuándo usarla |
> |------|-----------|---------------|
> | [`main`](https://github.com/Praskc/lsc-fingerspelling-edge/tree/main) | **Stable**: producción Vercel | Es la que estás viendo |
> | [`rolling`](https://github.com/Praskc/lsc-fingerspelling-edge/tree/rolling) | Bleeding edge con auto-bumps de dependencias | Probar features antes del merge a `main` |
> | [`legacy`](https://github.com/Praskc/lsc-fingerspelling-edge/tree/legacy) | YOSO v2 en JavaScript vanilla, archivado | Histórico / referencia |

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
| Latencia del modelo (ORT WASM SIMD) | **~0.7 ms** |
| Pipeline end-to-end por frame | **< 1 ms** (cero allocs por frame) |
| Tamaño del modelo ONNX | ~2.4 MB |
| Provider de inferencia | ONNX Runtime WASM con 2 hilos (WebGPU descartado: overhead >> compute para este tamaño) |

## Feature Engineering: 48 features

| Features | Descripción |
|----------|-------------|
| 42 coords | x,y × 21 landmarks normalizados anatómicamente |
| 1 ángulo global | `atan2(y₉, x₉)`, orientación de la palma |
| 5 distancias | Norma euclidiana punta→muñeca por dedo (landmarks 4, 8, 12, 16, 20) |

**Normalización anatómica:**
1. Traslación al origen desde la muñeca (landmark 0)
2. Escala fija por distancia muñeca→nudillo medio (landmark 9), invariante a distancia cámara-mano
3. Flip del eje X para mano izquierda, invarianza de lateralidad, ambidiestro por diseño

## Motor de inferencia

### Filtros de validación en cadena

```
Red neuronal → Softmax estable → Juez U/R → Filtro zona gris → Buffer votación → Letra confirmada
```

**Juez U/R**: discriminación geométrica entre U y R por posición relativa de landmarks 8 y 12 (cruce de dedos índice y corazón)

**Filtro zona gris**: entre 55% y 75% de confianza aplica penalización suave por distancia al centroide de clase. Por encima del 75% no penaliza para no rechazar señas válidas con alta confianza

**dist_ref por clase**: P75 de distancias intra-clase calculado sobre el training set. M y N tienen dist_ref 5-6× más altas que el resto por la alta varianza que genera la oclusión de dedos superpuestos

**Buffer de votación ponderado**: acumula pesos por frame, requiere peso mínimo equivalente a 5 votos sobre umbral para confirmar. Elimina detecciones espurias sin necesitar bajar la mano entre letras

**Cooldown por tipo:**
| Tipo | Cooldown |
|------|----------|
| Letra distinta | 800 ms |
| Misma letra (mantener seña) | 1800 ms |
| SPACE / DELETE | 400 ms |

**Escudo cinético**: SPACE y DELETE requieren jitter < 0.02 para evitar activación accidental por movimiento

### Hot path con cero allocaciones por frame

El loop de inferencia mantiene buffers preasignados que se reutilizan entre frames, eliminando GC presión durante sesiones largas:

| Estructura | Tipo | Reemplazo de |
|------------|------|--------------|
| `bufCoords` (42), `bufFeatures` (48) | `Float32Array` preasignado | Allocs en cada `_preprocesar` |
| `bufSoftmax` (28) | `Float32Array` preasignado | Allocs por frame en softmax |
| `_top3Buf` | Array de 3 objetos reutilizados | Objetos nuevos por frame |
| `_votosLetras` (Int8Array 9) + `_votosPesos` (Float32Array 9) + head circular | Buffer circular indexado | `Array<{letra,peso}>` con `push`/`shift` O(n) |
| `_pesoPorLetra` (Float32Array 28) | Acumulador indexado por letra | `Map<string,number>` |
| `_centroidesPorIndice` (28) | Lookup O(1) por índice del alfabeto | `centroides[letra.toLowerCase()]` por frame |
| `_tensor` + `_inputFeed` | Reutilizados entre `session.run()` | `new ort.Tensor` por frame |

Pre-cálculo de `invDp = 1/dp` reemplaza 42 divisiones por 42 multiplicaciones en la normalización anatómica.

## Pipeline de entrenamiento

### Preprocesado en `ml/train.py`

1. Recalibración anatómica forzada en cada fila, idempotente, si ya está normalizado no cambia nada
2. Ángulo global calculado on-the-fly
3. Split estratificado 85/15 con stratify por clase
4. **Limpieza de outliers IQR×3.0** solo sobre train set, elimina frames donde MediaPipe trackea mal
5. Centroides calculados **después** de la limpieza y **solo sobre train**: sin data leakage

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
| Dataset LSC propio | Comunidad sorda colombiana | - | En recolección | Fine-tuning LSC |

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
| **Ñ** | Con movimiento | No existe en ASL, clase nueva |

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
│   │   ├── app.ts          # Orquestador, pipeline Tasks-Vision, ROI, visibilidad, luminosidad
│   │   └── main.ts         # Entry point + registro del Service Worker
│   ├── engine/
│   │   ├── inference.ts    # Motor de IA, preprocesado, softmax, filtros, buffer circular de votos
│   │   └── types.ts        # Interfaces TypeScript del motor
│   ├── game/
│   │   └── game.ts         # Motor de gamificación, palabras por niveles, banco local 300 palabras
│   ├── lib/
│   │   └── signs.ts        # Diagramas SVG orgánicos del alfabeto (perspectiva observador)
│   ├── ui/
│   │   ├── hud.ts          # HUD de predicción y estado de mano
│   │   ├── debug.ts        # Panel de debug, métricas, buffer, top-3
│   │   ├── splash.ts       # Pantalla de carga
│   │   ├── toast.ts        # Notificaciones no intrusivas
│   │   ├── learn.ts        # Modo aprendizaje, grid del alfabeto
│   │   ├── onboarding.ts   # Tutorial de primera visita
│   │   └── index.ts        # Re-exporta RenderizadorUI
│   └── styles.css          # UI fluid con CSS custom properties + container queries
├── public/
│   ├── YOSO.onnx           # Modelo exportado (2.4 MB)
│   ├── Centroides.json     # Centroides + dist_ref P75 por clase
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker, cache-first CDN + Google Storage, network-first navegación
│   ├── robots.txt          # Directivas para crawlers
│   └── favicon.svg         # Ícono de la app
├── ml/
│   ├── __init__.py
│   ├── extract.py          # Extractor de landmarks desde imágenes del dataset
│   ├── train.py            # Entrenamiento, limpieza IQR, exportación ONNX
│   ├── features.py         # Feature engineering compartido (umbral 1e-4 alineado con TS)
│   ├── config.py           # Configuración del pipeline ML (datasets vía env YOSO_DATA_ROOTS)
│   └── model/              # Salida del entrenamiento (ONNX + JSON), no versionado
├── docker/
│   ├── Dockerfile          # Multi-stage: node:22-alpine builder → nginx:1.27-alpine runtime non-root
│   ├── compose.yaml        # Docker Compose, read-only fs, cap_drop ALL, tmpfs, memory limits
│   └── nginx.conf          # Listen 8080, gzip ampliado, sendfile, CSP completa, dotfile deny
├── docs/                   # Documentación generada, no versionado (gitignored)
├── index.html              # HTML principal
├── vite.config.ts          # COOP/COEP + manualChunks (ort/mediapipe) + terser + lightningcss
├── vercel.json             # Headers de seguridad completos (HSTS, CORP, Permissions-Policy, CSP)
├── tsconfig.json           # TypeScript strict mode
├── package.json            # pnpm@11, override protobufjs ≥7.5.8 (CVE)
├── pnpm-lock.yaml
├── pnpm-workspace.yaml     # Workspace pnpm (sin packages anidados, root simple)
├── .dockerignore
└── .gitignore              # Ignora docs/superpowers/, ml/model/, dist/, node_modules/
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

# Entrenar, exporta YOSO.onnx y Centroides.json a ml/model/
python ml/train.py

# Copiar al directorio public para que Vite los sirva
cp ml/model/YOSO.onnx public/
cp ml/model/Centroides.json public/
```

> **Consistencia crítica:** `ml/extract.py`, `ml/train.py` e `src/engine/inference.ts` implementan el mismo pipeline de normalización anatómica. Cualquier cambio debe aplicarse en los tres. El umbral de descarte de mano colapsada (`dp <= 1e-4`) está alineado entre `ml/features.py` y `src/engine/inference.ts`.

> **Datasets configurables:** `ml/config.py` lee la variable de entorno `YOSO_DATA_ROOTS` (rutas separadas por `;` en Windows o `:` en Unix) para apuntar a tus propios datasets, sin tocar código.

## Despliegue

### Vercel

Listo para desplegar sin configuración adicional. `vercel.json` configura el set completo de headers de seguridad: COOP/COEP (para SharedArrayBuffer), HSTS (2 años + includeSubDomains), CORP (`same-origin`), Permissions-Policy (cámara permitida, resto deshabilitado), CSP estricta (`'wasm-unsafe-eval'` sin `'unsafe-eval'`), X-Frame-Options DENY.

```bash
pnpm run build
# Conectar el repositorio en vercel.com, detección automática de Vite
```

### Docker

Build multi-stage: construye con Node 22 Alpine (con BuildKit cache mount para pnpm store) y sirve con nginx 1.27 Alpine. El contenedor está hardened con perfil de producción:

| Hardening | Implementación |
|-----------|----------------|
| Usuario no-root | `USER nginx` en el stage final, listen en 8080 |
| Read-only filesystem | `read_only: true` en compose |
| Capacidades mínimas | `cap_drop: [ALL]` + cap_add solo `CHOWN`, `SETUID`, `SETGID`, `NET_BIND_SERVICE` |
| Sin escalada de privilegios | `security_opt: [no-new-privileges:true]` |
| Tmpfs aislados | `/var/cache/nginx`, `/var/run`, `/tmp` con tamaños acotados |
| Límites de recursos | `mem_limit: 256m`, `pids_limit: 100` |
| Healthcheck | `wget -q --spider http://127.0.0.1:8080/` cada 30s |

```bash
docker compose -f docker/compose.yaml up --build       # http://localhost:8080
docker compose -f docker/compose.yaml up --build -d    # En segundo plano
```

El `nginx.conf` incluye además:
- `server_tokens off` (no leak de versión)
- `limit_except GET HEAD OPTIONS` (read-only)
- `sendfile on; tcp_nopush on; tcp_nodelay on; aio threads` (kernel zero-copy)
- `keepalive_timeout 30; keepalive_requests 100` (mobile reconnect)
- `gzip` ampliado a `application/wasm` y `application/octet-stream` con `gzip_static on`
- `location ~ /\. { deny all; }` (dotfiles bloqueados)
- Caché diferenciada (assets con hash `immutable`, modelo 7 días, SW sin caché)
- Headers de seguridad COOP/COEP/HSTS/CORP/Permissions-Policy/CSP en cada `location`

## Notas técnicas

**Lateralidad MediaPipe Tasks-Vision**: A diferencia de la API legacy, Tasks-Vision 0.10.35 etiqueta la mano derecha física como `'Right'`. El flip de eje X se aplica cuando `handedness.label === 'Left'` (mano izquierda física vista en espejo)

**M y N**: son las clases con mayor varianza intra-clase por oclusión de dedos superpuestos. Sus dist_ref son 5-6× más altas que el resto

**SharedArrayBuffer**: ONNX Runtime WASM con `intraOpNumThreads: 2` requiere los headers `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`. Configurados en `vite.config.ts` (dev/preview), `vercel.json` (producción Vercel) y `docker/nginx.conf` (Docker)

**Service Worker y modelo ONNX**: el modelo (2.4 MB) se precachea en la instalación del SW. Tras la primera carga la app funciona completamente offline. La versión de caché es `yoso-v8`. Bumpeada al migrar a self-hosting de assets (URLs cambiaron, requiere invalidar cache viejo). PRECACHE list se mantiene mínima para evitar la regresión de FPS observada en v7 con precache extendido.

**Bundle partitionado**: Vite produce chunks separados: `ort-*.js` (~402 KB), `mediapipe-*.js` (~132 KB), `index-*.js` (~37 KB). Updates de código de app preservan los caches de ORT y MediaPipe en el SW, reduciendo bytes re-descargados tras un deploy. Minificación con terser en 2 pasadas y CSS con lightningcss

**WebGPU vs WASM SIMD**: Para modelos pequeños como este FCNN (~455K params), el overhead fijo de WebGPU (dispatch + sync + transferencia) excede el ahorro de compute. Se prefiere WASM SIMD con 2 hilos: latencia ~0.7ms vs ~10ms con WebGPU. Documentado en el commit `78ec8fe`

## Assets de terceros self-hosted

A partir de v3.1, todos los binarios necesarios para inferencia se sirven desde el mismo origen que la app, eliminando dependencia runtime de CDN externos:

| Asset | Origen original | Tamaño | Servido desde |
|-------|------------------|--------|----------------|
| `hand_landmarker.task` | MediaPipe (Google) | ~7.5 MB | `/mediapipe/` (commiteado a public/) |
| `vision_wasm_internal.{js,wasm}` | @mediapipe/tasks-vision | ~5 MB | `/mediapipe/` (copy en build) |
| `ort-wasm-simd-threaded.{mjs,wasm}` | onnxruntime-web | ~12 MB | `/ort/` (copy en build) |

Atribuciones legales completas en [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Licencias compatibles: Apache 2.0 (MediaPipe) y MIT (ORT).

Implicancias:

- App arranca sin internet desde el primer load (si está instalada como PWA)
- CSP `script-src` y `connect-src` sin orígenes externos (solo `'self'` + `api.datamuse.com`)
- Bundle inicial: 27 MB (vs 5 MB antes), cacheado por SW en primera visita
- Cero dependencia de disponibilidad de `cdn.jsdelivr.net` o `storage.googleapis.com`

## Ramas

| Rama | Descripción |
|------|-------------|
| `main` | Legacy, JavaScript vanilla, arquitectura original v1 |
| `refactor` | Actual, TypeScript strict, arquitectura modular, MediaPipe Tasks-Vision, PWA, CSP completa |

## Changelog

### v3.0: pulido total del backend (actual)
Motor con cero allocaciones por frame mediante buffer circular de votos (`Int8Array(9)` + `Float32Array(9)` + head pointer), acumulador de pesos indexado por letra (`Float32Array(28)` reemplazando `Map<string,number>`), reuso de `ort.Tensor` y `inputFeed` entre frames, pre-cálculo de `invDp` (1 división vs 42), mapa de centroides indexado por posición en alfabeto. Build optimizado: terser passes 2, manualChunks separando ORT y MediaPipe, CSS con lightningcss, target ES2022. Docker hardened: usuario nginx no-root con HEALTHCHECK, listen 8080, read-only filesystem, `cap_drop ALL`, `no-new-privileges`, tmpfs para escrituras, límites de memoria y PIDs. Nginx con sendfile + tcp_nopush + keepalive optimizado + gzip ampliado a WASM/ONNX + `server_tokens off` + dotfile deny. Seguridad: CSP sin `'unsafe-eval'` (usa `'wasm-unsafe-eval'`), HSTS 2 años, Cross-Origin-Resource-Policy, Permissions-Policy estricta, pin de protobufjs ≥7.5.8 (CVE). ML alineado: umbral `1e-4` en `ml/features.py` consistente con TypeScript, `YOSO_DATA_ROOTS` configurable por env, wrap angular en augmentation.

### v3: refactor
Modularización de `src/` en `core/`, `engine/`, `game/`, `lib/` y `ui/`. Migración a `@mediapipe/tasks-vision@0.10.35` con fix de lateralidad. CSP en Vercel y Docker. Service worker `yoso-v6` con cache de Google Storage. Panel de debug extendido con MP frame y FPS. `compose.yaml` movido a `docker/`.

### v2: refactor
Migración a TypeScript strict. PWA instalable y funcional offline. Gamificación con banco local de 300 palabras. Modo aprendizaje con grid interactivo. Buffer de votación ponderado. ROI adaptativo. Detección de luminosidad. Panel de debug. Deploy en Vercel y Docker.

### v1: main (legacy)
JavaScript vanilla. Pipeline de 48 features con normalización anatómica. Filtro zona gris con dist_ref P75. Dataset ~360k muestras, 98.63% accuracy.

## Roadmap

### En progreso
- [ ] Recolección dataset LSC, 35 personas, 28 clases, colaboración con intérpretes certificados
- [ ] Fine-tuning FCNN para 8 clases estáticas distintas entre ASL y LSC
- [ ] GRU unidireccional para 5 letras con movimiento (J, Ñ, S, G, Z)

### Siguiente fase
- [ ] Cuantización INT8 para deployment en ESP32-S3, TinyML edge
- [ ] Panel de referencia visual con todas las señas LSC
- [ ] Coordenada Z de MediaPipe en extracción de features, reduce falsos positivos por oclusión
- [ ] Features de curvatura e ángulos inter-dedo para M/N/E/S

## Contexto

Este proyecto nace en **Sucre, Colombia**. El reconocimiento de lengua de señas es un derecho de comunicación, no un producto, por ende YOSO es y será siempre open source, desarrollado en colaboración con la comunidad sorda colombiana de la universidad de Sucre.

## Autor

**Esteban Cotera**: Estudiante de Ingeniería electrónica, Sucre, Colombia


</div>
