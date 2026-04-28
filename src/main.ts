// MAIN.TS — Entry point
import { YOSOApp } from './app'

document.addEventListener('DOMContentLoaded', () => {
  const app = new YOSOApp()
  app.start()
})