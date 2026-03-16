import { useEffect } from 'react'

export function useSnapScroll(sectionSelector = '.snap-section') {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector))
    if (sections.length === 0) return

    let isLocked = false
    let touchStartY = 0
    let scrollTimeout: number | undefined
    let lockUntil = 0

    const scrollToIndex = (index: number) => {
      const target = sections[Math.max(0, Math.min(sections.length - 1, index))]
      if (!target) return
      isLocked = true
      lockUntil = Date.now() + 900
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const getCurrentIndex = () => {
      const scrollTop = window.scrollY + window.innerHeight * 0.25
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
        }
      }, 520)
    }

    const handleWheel = (event: WheelEvent) => {
      if (isLocked) return
      if (Math.abs(event.deltaY) < 10) return
      event.preventDefault()
      const currentIndex = getCurrentIndex()
      const direction = event.deltaY > 0 ? 1 : -1
      scrollToIndex(currentIndex + direction)
    }

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (isLocked) return
      const touchEndY = event.changedTouches[0]?.clientY ?? 0
      const delta = touchStartY - touchEndY
      if (Math.abs(delta) < 40) return
      event.preventDefault()
      const currentIndex = getCurrentIndex()
      const direction = delta > 0 ? 1 : -1
      scrollToIndex(currentIndex + direction)
    }

    const handleScroll = () => {
      if (!isLocked) return
      releaseLock()
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: false })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [sectionSelector])
}
