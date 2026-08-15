import DefaultTheme from 'vitepress/theme'
import './custom.css'
import Layout from './components/Layout.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app, router }) {
    // Reading progress bar
    if (typeof window !== 'undefined') {
      const createProgressBar = () => {
        const bar = document.createElement('div')
        bar.className = 'reading-progress'
        bar.id = 'reading-progress'
        document.body.appendChild(bar)

        const updateProgress = () => {
          const scrollTop = window.scrollY
          const docHeight = document.documentElement.scrollHeight - window.innerHeight
          const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
          bar.style.width = `${Math.min(progress, 100)}%`
        }

        window.addEventListener('scroll', updateProgress, { passive: true })
        updateProgress()
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createProgressBar)
      } else {
        createProgressBar()
      }

      router.onAfterRouteChanged = () => {
        setTimeout(() => {
          const existing = document.getElementById('reading-progress')
          if (existing) {
            const scrollTop = window.scrollY
            const docHeight = document.documentElement.scrollHeight - window.innerHeight
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
            existing.style.width = `${Math.min(progress, 100)}%`
          } else {
            createProgressBar()
          }
        }, 100)
      }
    }
  },
}
