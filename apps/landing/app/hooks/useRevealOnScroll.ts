import { useEffect } from 'react'

export function useRevealOnScroll() {
  useEffect(() => {
    const panelStack = document.querySelector<HTMLElement>('.panel-stack')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, root: panelStack ?? null, rootMargin: '0px 0px -40px 0px' }
    )

    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])
}
