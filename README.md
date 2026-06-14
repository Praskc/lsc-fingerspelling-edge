<div align="center">

# YOSO: You Only Sign Once

**Motor de reconocimiento de Lengua de Señas Colombiana (LSC) en tiempo real**
*Inferencia edge · Sin servidor · < 10ms de latencia*

[![Branch: rolling](https://img.shields.io/badge/rama-rolling-0EA5E9?style=flat-square)](https://github.com/Praskc/lsc-fingerspelling-edge/tree/rolling)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-Web-FF6F00?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision_0.10.35-00897B?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
[![License](https://img.shields.io/badge/Licencia-MIT-green?style=flat-square)](LICENSE)

</div>

> **Estás viendo la rama `rolling`, desarrollo activo.**
>
> | Rama | Propósito |
> |------|-----------|
> | [`rolling`](https://github.com/Praskc/lsc-fingerspelling-edge/tree/rolling) | **Activa**: desarrollo continuo, self-hosted, todo lo nuevo entra aquí |
> | [`main`](https://github.com/Praskc/lsc-fingerspelling-edge/tree/main) | Estable: snapshot validado de `rolling`, se actualiza por merge manual |

## ¿Qué es YOSO?

YOSO es un sistema completo de reconocimiento del alfabeto dactilológico de la **Lengua de Señas Colombiana (LSC)** que corre **100% en el navegador**, sin servidor, sin conexión a internet y con latencia de inferencia menor a 10ms.

El sistema fue desarrollado para reducir las barreras de comunicación de la comunidad sorda colombiana, usando tecnología edge accesible desde cualquier dispositivo con cámara y navegador, sin infraestructura costosa.

> **Estado actual:** El modelo base fue entrenado con datos ASL como prueba de concepto. La migración completa a LSC está en progreso con dataset propio recolectado con la comunidad sorda colombiana en colaboración con intérpretes certificados.

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

**dist_ref por clase**: P75 de distancias intra-clase calculado sobre el training set. M y N tienen dist_ref 5-6x más altas que el resto por la alta varianza que genera la oclusión de dedos superpuestos

**Buffer de votación ponderado**: acumula pesos por frame, requiere peso mínimo equivalente a 5 votos sobre umbral para confirmar. Elimina detecciones espurias sin necesitar bajar la mano entre letras

**Cooldown por tipo:**
| Tipo | Cooldown |
|------|----------|
| Letra distinta | 800 ms |
| Misma letra (mantener seña) | 1800 ms |
| SPACE / DELETE | 400 ms |

**Escudo cinético**: SPACE y DELETE requieren jitter < 0.02 para evitar activación accidental por movimiento

### Hot path con cero allocaciones por frame

El loop de inferencia mantiene buffers preasignados que se reutilizan entre frames, eliminando presión de GC durante sesiones largas:

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

1. Recalibración anatómica forzada en cada fila, idempotente
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
| Augmentation | Ruido gaussiano + rotación ±20° + escala 0.88-1.12 |
| Early stopping | patience=15 sobre accuracy de test |

### Diagnóstico automático

`ml/train.py` verifica que la normalización fue correcta antes de entrenar:
- `x̄_muñ ≈ 0` y `ȳ_muñ ≈ 0` → muñeca en el origen
- `‖p9‖ ≈ 1.000` → escala anatómica aplicada

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
│   │   ├── app.ts              # Orquestador: pipeline Tasks-Vision, ROI, visibilidad, luminosidad
│   │   └── main.ts             # Entry point + registro del Service Worker
│   ├── engine/
│   │   ├── inference.ts        # Motor IA: preprocesado, softmax, filtros, buffer circular de votos
│   │   └── types.ts            # Interfaces TypeScript del motor
│   ├── game/
│   │   └── game.ts             # Motor de gamificación, 300 palabras, 5 niveles, eventos yoso:juego
│   ├── lib/
│   │   └── signs.ts            # Diagramas SVG del alfabeto (perspectiva observador)
│   ├── ui/
│   │   ├── index.ts            # RenderizadorUI: orquesta todos los paneles
│   │   ├── hud.ts              # HUD de predicción, métricas de mano y estado
│   │   ├── output.ts           # Panel traductor: letra, buffer, stream de confianza
│   │   ├── panel-left.ts       # Indicador live de cámara activa
│   │   ├── game-panel.ts       # Panel entrenamiento: constelación de niveles, historial
│   │   ├── learn.ts            # Modo aprendizaje: grid del alfabeto con estado visto/activo
│   │   ├── splash.ts           # Pantalla de carga y estado vacío
│   │   ├── toast.ts            # Notificaciones no intrusivas
│   │   ├── onboarding.ts       # Tutorial de primera visita
│   │   ├── debug.ts            # Panel de debug, métricas, top-3
│   │   └── site-footer.ts      # Footer con créditos
│   └── styles/
│       ├── tokens.css          # Variables OKLCH, tipografía, espaciado
│       ├── base.css            # Reset y estilos base
│       ├── layout.css          # Shell de la app, breakpoints
│       ├── index.css           # Entry: importa todos los módulos CSS
│       ├── motion.css          # Animaciones y transiciones
│       ├── reset.css           # Reset de navegador
│       ├── components/         # buffer, button, hud, output, signature, tabs, video
│       ├── modes/              # aprendizaje, entrenamiento, traductor
│       └── overlays/           # empty-state, onboarding, splash, toast
├── public/
│   ├── YOSO.onnx               # Modelo exportado (2.4 MB)
│   ├── Centroides.json         # Centroides + dist_ref P75 por clase
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker v12, cache-first assets, network-first navegación
│   ├── robots.txt
│   └── favicon.svg
├── ml/
│   ├── extract.py              # Extractor de landmarks desde imágenes del dataset
│   ├── train.py                # Entrenamiento, limpieza IQR, exportación ONNX
│   ├── features.py             # Feature engineering compartido
│   ├── config.py               # Configuración del pipeline ML
│   └── model/                  # Salida del entrenamiento, no versionado
├── docker/
│   ├── Dockerfile              # Multi-stage: node:22-alpine builder → nginx:1.27-alpine runtime
│   ├── compose.yaml            # Docker Compose con hardening completo
│   └── nginx.conf              # Listen 8080, COOP/COEP, gzip WASM, CSP, cache diferenciada
├── index.html
├── vite.config.ts              # COOP/COEP + manualChunks (ort/mediapipe) + terser + lightningcss
├── tsconfig.json               # TypeScript strict mode
├── package.json                # pnpm@11, override protobufjs ≥7.5.8 (CVE)
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── CLAUDE.md                   # Instrucciones para Claude Code
├── LICENSE                     # MIT
├── THIRD_PARTY_LICENSES.md
├── .dockerignore
└── .gitignore
```

## Instalación y uso

### Requisitos

Node.js 18+ y pnpm

```bash
git clone https://github.com/Praskc/lsc-fingerspelling-edge.git
cd lsc-fingerspelling-edge
pnpm install
pnpm dev
```

Abre `http://localhost:5173` y permite acceso a la cámara.

### Entrenamiento

```bash
pip install torch torchvision pandas numpy scikit-learn onnx

python ml/extract.py
python ml/train.py

cp ml/model/YOSO.onnx public/
cp ml/model/Centroides.json public/
```

> **Consistencia crítica:** `ml/extract.py`, `ml/train.py` y `src/engine/inference.ts` implementan el mismo pipeline de normalización anatómica. Cualquier cambio debe aplicarse en los tres. El umbral de descarte de mano colapsada (`dp <= 1e-4`) está alineado entre `ml/features.py` y `src/engine/inference.ts`.

> **Datasets configurables:** `ml/config.py` lee la variable de entorno `YOSO_DATA_ROOTS` (rutas separadas por `;` en Windows o `:` en Unix).

## Despliegue

### Vercel

`vercel.json` ya trae todo: comandos de build con pnpm, output `dist/` y los headers COOP/COEP que ONNX Runtime necesita para `SharedArrayBuffer`, más CSP, Permissions-Policy y el resto de headers de seguridad. Solo hay que importar el repo en [vercel.com](https://vercel.com) y apuntar la rama de producción a `rolling`.

### Docker

Build multi-stage: construye con Node 22 Alpine y sirve con nginx 1.27 Alpine. Hardened para producción:

| Hardening | Implementación |
|-----------|----------------|
| Usuario no-root | `USER nginx`, listen en 8080 |
| Read-only filesystem | `read_only: true` en compose |
| Capacidades mínimas | `cap_drop: [ALL]` + cap_add solo `CHOWN`, `SETUID`, `SETGID`, `NET_BIND_SERVICE` |
| Sin escalada de privilegios | `security_opt: [no-new-privileges:true]` |
| Tmpfs aislados | `/var/cache/nginx`, `/var/run`, `/tmp` con tamaños acotados |
| Límites de recursos | `mem_limit: 256m`, `pids_limit: 100` |

```bash
docker compose -f docker/compose.yaml up --build       # http://localhost:8080
docker compose -f docker/compose.yaml up --build -d    # en segundo plano
```

El `nginx.conf` incluye:
- `server_tokens off`
- `limit_except GET HEAD OPTIONS`
- `sendfile on; tcp_nopush on; tcp_nodelay on; aio threads`
- `gzip` ampliado a `application/wasm` y `application/octet-stream`
- `location ~ /\. { deny all; }`
- Caché diferenciada (assets con hash `immutable`, modelo 7 días, SW sin caché)
- Headers de seguridad COOP/COEP/HSTS/CORP/Permissions-Policy/CSP en cada `location`

## Notas técnicas

**Lateralidad MediaPipe Tasks-Vision**: Tasks-Vision 0.10.35 etiqueta la mano derecha física como `'Right'`. El flip de eje X se aplica cuando `handedness.label === 'Left'`.

**M y N**: son las clases con mayor varianza intra-clase por oclusión de dedos superpuestos. Sus dist_ref son 5-6x más altas que el resto.

**SharedArrayBuffer**: ONNX Runtime WASM con `intraOpNumThreads: 2` requiere `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`. Configurados en `vite.config.ts` (dev/preview) y `docker/nginx.conf` (producción).

**Service Worker**: el modelo (2.4 MB) se precachea en la instalación del SW. Tras la primera carga la app funciona completamente offline. La versión de caché es `yoso-v12`.

**Bundle particionado**: Vite produce chunks separados: `ort-*.js` (~402 KB), `mediapipe-*.js` (~132 KB), `index-*.js` (~37 KB). Updates de código de app preservan los caches de ORT y MediaPipe en el SW, reduciendo bytes re-descargados tras un deploy.

**WebGPU vs WASM SIMD**: Para este FCNN (~455K params), el overhead fijo de WebGPU (dispatch + sync + transferencia) excede el ahorro de compute. Se prefiere WASM SIMD con 2 hilos: latencia ~0.7ms vs ~10ms con WebGPU.

## Assets de terceros self-hosted

Todos los binarios necesarios para inferencia se sirven desde el mismo origen, sin dependencia de CDN externos:

| Asset | Origen | Tamaño | Servido desde |
|-------|--------|--------|---------------|
| `hand_landmarker.task` | MediaPipe (Google) | ~7.5 MB | `/mediapipe/` |
| `vision_wasm_internal.{js,wasm}` | @mediapipe/tasks-vision | ~5 MB | `/mediapipe/` |
| `ort-wasm-simd-threaded.{mjs,wasm}` | onnxruntime-web | ~12 MB | `/ort/` |
| Bricolage Grotesque Variable | Fontsource | ~300 KB | self (pnpm) |
| Geist Variable, Geist Mono Variable | Fontsource | ~200 KB | self (pnpm) |

Atribuciones legales completas en [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Implicancias:
- App arranca sin internet desde el primer load (si está instalada como PWA)
- CSP `script-src` y `connect-src` sin orígenes externos (solo `'self'` + `api.datamuse.com`)
- Bundle inicial: ~27 MB, cacheado por SW en primera visita

## Changelog

### v3.1: UI modular y performance frontend (actual)

CSS refactorizado en módulos (`src/styles/components/`, `modes/`, `overlays/`) con tokens OKLCH. Fuentes self-hosted via Fontsource (Bricolage Grotesque Variable + Geist Variable), eliminando la dependencia de Google Fonts. DOM write guards en HUD y PanelLeft: early-return cuando el valor no cambia (~30fps sin escrituras redundantes). Buffer cells cacheadas y coordenadas X precalculadas en OutputPanel, running sum para el promedio del stream. Eventos `yoso:juego` personalizados reemplazando MutationObserver en GamePanel. Service worker v12 simplificado a cache-first puro sin handlers CDN obsoletos. Licencia MIT.

### v3.0: pulido total del backend

Motor con cero allocaciones por frame mediante buffer circular de votos (`Int8Array(9)` + `Float32Array(9)` + head pointer), acumulador de pesos indexado por letra (`Float32Array(28)` reemplazando `Map<string,number>`), reuso de `ort.Tensor` y `inputFeed` entre frames, pre-cálculo de `invDp`. Build optimizado: terser passes 2, manualChunks separando ORT y MediaPipe, CSS con lightningcss. Docker hardened: usuario nginx no-root, read-only filesystem, `cap_drop ALL`, `no-new-privileges`, tmpfs, límites de memoria y PIDs. Seguridad: CSP con `'wasm-unsafe-eval'`, HSTS, CORP, Permissions-Policy, pin de protobufjs ≥7.5.8 (CVE).

### v3: refactor

Modularización de `src/` en `core/`, `engine/`, `game/`, `lib/` y `ui/`. Migración a `@mediapipe/tasks-vision@0.10.35` con fix de lateralidad. Panel de debug extendido con MP frame y FPS.

### v2

Migración a TypeScript strict. PWA instalable y funcional offline. Gamificación con banco local de 300 palabras. Modo aprendizaje con grid interactivo. Buffer de votación ponderado. ROI adaptativo. Detección de luminosidad.

### v1 (histórico)

JavaScript vanilla, hoy solo en el historial de git. Pipeline de 48 features con normalización anatómica. Filtro zona gris con dist_ref P75. Dataset ~360k muestras, 98.63% accuracy.

## Roadmap

### En progreso
- [ ] Recolección dataset LSC, 35 personas, 28 clases, colaboración con intérpretes certificados
- [ ] Fine-tuning FCNN para 8 clases estáticas distintas entre ASL y LSC
- [ ] GRU unidireccional para 5 letras con movimiento (J, Ñ, S, G, Z)

### Siguiente fase
- [ ] Migración de MediaPipe Tasks-Vision a Web Worker con OffscreenCanvas: libera ~7ms/frame del main thread
- [ ] Cuantización INT8 para deployment en ESP32-S3, TinyML edge
- [ ] Panel de referencia visual con todas las señas LSC
- [ ] Coordenada Z de MediaPipe en extracción de features
- [ ] Features de curvatura e ángulos inter-dedo para M/N/E/S

## Contexto

Este proyecto nace en **Sincelejo, Sucre, Colombia**. El reconocimiento de lengua de señas es un derecho de comunicación, no un producto, por ende YOSO es y será siempre open source, desarrollado en colaboración con la comunidad sorda colombiana de la Universidad de Sucre.

## Autor

**Esteban Cotera** — Estudiante de Ingeniería Electrónica, Sincelejo, Colombia
[github.com/Praskc](https://github.com/Praskc)

</div>
