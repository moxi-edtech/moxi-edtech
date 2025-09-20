"use client"

import { useEffect, useRef } from 'react'
import { recordAuditClient, type AuditEvent } from '@/lib/auditClient'

export default function AuditPageView(props: AuditEvent) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    recordAuditClient({
      ...props,
      action: props.action || 'PAGE_VIEW',
      entity: props.entity || 'page',
    })
  // props should be considered static per page load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
