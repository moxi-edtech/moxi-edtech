import { useEffect } from 'react'

export function useSnapScroll(sectionSelector = 'section, footer') {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector)).filter(
      (section) => section.offsetHeight > 0
    )

    if (sections.length < 2) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let isLocked = false
    let lockUntil = 0
    let scrollTimeout: number | undefined
    let wheelAccumulator = 0

    const scrollToIndex = (index: number) => {
      const target = sections[Math.max(0, Math.min(sections.length - 1, index))]
      if (!target) return
      isLocked = true
      lockUntil = Date.now() + 820
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const getCurrentIndex = () => {
      const scrollTop = window.scrollY + window.innerHeight * 0.35
      let currentIndex = 0

      sections.forEach((section, index) => {
        if (section.offsetTop <= scrollTop) {
          currentIndex = index
        }
      })

      return currentIndex
    }

    const releaseLock = () => {
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
      scrollTimeout = window.setTimeout(() => {
        if (Date.now() >= lockUntil) {
          isLocked = false
          wheelAccumulator = 0
        }
      }, 420)
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      if (isLocked) {
        event.preventDefault()
        return
      }

      wheelAccumulator += event.deltaY
      if (Math.abs(wheelAccumulator) < 30) return

      event.preventDefault()
      const currentIndex = getCurrentIndex()
      const direction = wheelAccumulator > 0 ? 1 : -1
      wheelAccumulator = 0
      scrollToIndex(currentIndex + direction)
    }

    const handleScroll = () => {
      if (isLocked) {
        releaseLock()
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) window.clearTimeout(scrollTimeout)
    }
  }, [sectionSelector])
}
