import { useEffect } from 'react'

export function useSnapScroll(sectionSelector = '.panel', containerSelector = '.panel-stack') {
  useEffect(() => {
    const panelStack = document.querySelector<HTMLElement>(containerSelector)
    if (!panelStack) return

    const getSections = () =>
      Array.from(panelStack.querySelectorAll<HTMLElement>(sectionSelector)).filter(
        (section) => section.offsetParent !== null
      )
    let sections = getSections()
    if (sections.length === 0) return

    let isLocked = false
    let scrollTimeout: number | undefined
    let lockUntil = 0
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches

    const scrollToIndex = (index: number) => {
      const target = sections[Math.max(0, Math.min(sections.length - 1, index))]
      if (!target) return
      isLocked = true
      lockUntil = Date.now() + 900
      panelStack.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    }

    const getCurrentIndex = () => {
      const scrollTop = panelStack.scrollTop
      let currentIndex = 0
      let closestDistance = Number.POSITIVE_INFINITY
      sections.forEach((section, index) => {
        const distance = Math.abs(section.offsetTop - scrollTop)
        if (distance < closestDistance) {
          closestDistance = distance
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

    const shouldAllowInternalScroll = (eventTarget: EventTarget | null, deltaY: number) => {
      if (!(eventTarget instanceof HTMLElement)) return false
      const scrollable = eventTarget.closest<HTMLElement>('.panel__body')
      if (!scrollable) return false
      if (scrollable.scrollHeight <= scrollable.clientHeight) return false
      const maxScrollTop = scrollable.scrollHeight - scrollable.clientHeight
      if (deltaY > 0) {
        return scrollable.scrollTop < maxScrollTop
      }
      if (deltaY < 0) {
        return scrollable.scrollTop > 0
      }
      return false
    }

    const handleWheel = (event: WheelEvent) => {
      if (isLocked) return
      if (Math.abs(event.deltaY) < 10) return
      if (sections.length === 0) return
      if (shouldAllowInternalScroll(event.target, event.deltaY)) return
      event.preventDefault()
      const currentIndex = getCurrentIndex()
      const direction = event.deltaY > 0 ? 1 : -1
      scrollToIndex(currentIndex + direction)
    }

    const handleScroll = () => {
      if (!isLocked) return
      releaseLock()
    }

    const handleResize = () => {
      sections = getSections()
    }

    if (!isCoarsePointer) {
      panelStack.addEventListener('wheel', handleWheel, { passive: false })
      panelStack.addEventListener('scroll', handleScroll, { passive: true })
      window.addEventListener('resize', handleResize)
    }

    return () => {
      if (!isCoarsePointer) {
        panelStack.removeEventListener('wheel', handleWheel)
        panelStack.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [sectionSelector, containerSelector])
}
