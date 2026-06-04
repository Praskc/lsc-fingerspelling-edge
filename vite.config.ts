import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { copyFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'

const COOP_HEADERS = {
  'Cross-Origin-Opener-Policy':  'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// Self-hosting: copia los WASM de ORT y MediaPipe a dist/ con paths flat.
// vite-plugin-static-copy v4 preserva la estructura de directorios del src,
// lo cual es indeseable para node_modules. Plugin inline para control total.
const ASSETS_SELF_HOSTED: Array<[string, string]> = [
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',        'ort/ort-wasm-simd-threaded.mjs'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',       'ort/ort-wasm-simd-threaded.wasm'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js',   'mediapipe/vision_wasm_internal.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', 'mediapipe/vision_wasm_internal.wasm'],
]

const copiaAssetsSelfHosted: Plugin = {
  name: 'copia-assets-self-hosted',
  apply: 'build',
  async closeBundle() {
    const outDir = resolve(process.cwd(), 'dist')
    for (const [src, dest] of ASSETS_SELF_HOSTED) {
      const srcAbs  = resolve(process.cwd(), src)
      const destAbs = resolve(outDir, dest)
      await mkdir(dirname(destAbs), { recursive: true })
      await copyFile(srcAbs, destAbs)
    }
  }
}

// Excluye los .wasm que Rollup bundlea espontáneamente (variantes JSEP/asyncify
// que no usamos). Solo queremos los WASM copiados explícitamente arriba.
const excluirWasmRollup: Plugin = {
  name: 'excluir-wasm-rollup',
  generateBundle(_, bundle) {
    for (const key of Object.keys(bundle)) {
      if (key.endsWith('.wasm')) delete bundle[key]
    }
  }
}

export default defineConfig({
  server:  { port: 5173, headers: COOP_HEADERS, allowedHosts: true },
  preview: { headers: COOP_HEADERS },
  optimizeDeps: {
    exclude: ['onnxruntime-web', '@mediapipe/tasks-vision']
  },
  plugins: [copiaAssetsSelfHosted],
  build: {
    target:    'es2022',
    minify:    'terser',
    cssMinify: 'lightningcss',
    terserOptions: {
      compress: {
        passes:     2,
        drop_console: false,
        pure_funcs: ['console.debug', 'console.info']
      },
      mangle: { safari10: true }
    },
    rollupOptions: {
      plugins: [excluirWasmRollup],
      output: {
        manualChunks: {
          'ort':       ['onnxruntime-web'],
          'mediapipe': ['@mediapipe/tasks-vision'],
        }
      }
    }
  }
})
