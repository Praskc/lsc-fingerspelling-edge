// MAIN.TS — Punto de entrada
import { YOSOApp } from './app'

document.addEventListener('DOMContentLoaded', () => {
  const app = new YOSOApp()
  app.iniciar()
})