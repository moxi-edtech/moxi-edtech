export type ProximaAulaSlot = {
  slot_id: string | null;
  weekday: number | null;
  inicio: string | null;
  fim: string | null;
  sala: string | null;
  ordem?: number | null;
}

const SECONDS_IN_DAY = 24 * 60 * 60
export function normalizeIsoWeekday(day: number): number {
  if (!Number.isFinite(day)) return 1
  const n = Math.trunc(day)
  if (n === 0) return 7
  if (n >= 1 && n <= 7) return n
  const mod = ((n % 7) + 7) % 7
  return mod === 0 ? 7 : mod
}

export function timeToSeconds(time: string | null | undefined): number {
  if (!time) return Number.NaN
  const [hh, mm, ss = '00'] = time.split(':')
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss)
}

function slotWeekOffsetSeconds(slot: ProximaAulaSlot, nowIsoWeekday: number, nowSeconds: number): number {
  const slotIsoDay = normalizeIsoWeekday(slot.weekday ?? 1)
  const startSec = timeToSeconds(slot.inicio)
  const endSec = timeToSeconds(slot.fim)

  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) return Number.POSITIVE_INFINITY

  const dayDelta = (slotIsoDay - nowIsoWeekday + 7) % 7

  if (dayDelta === 0) {
    if (nowSeconds <= endSec) {
      return Math.max(0, startSec - nowSeconds)
    }
    return (7 * SECONDS_IN_DAY) - nowSeconds + startSec
  }

  return dayDelta * SECONDS_IN_DAY - nowSeconds + startSec
}

export function escolherProximaAula(
  slots: ProximaAulaSlot[],
  now: Date
): ProximaAulaSlot | null {
  const nowIsoWeekday = normalizeIsoWeekday(now.getDay())
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()

  const valid = slots
    .filter((slot) => slot.slot_id && slot.weekday && slot.inicio && slot.fim)
    .map((slot) => ({
      slot,
      offsetSeconds: slotWeekOffsetSeconds(slot, nowIsoWeekday, nowSeconds),
      start: timeToSeconds(slot.inicio),
      ordem: slot.ordem ?? Number.MAX_SAFE_INTEGER,
    }))
    .filter((entry) => Number.isFinite(entry.offsetSeconds))
    .sort((a, b) => {
      if (a.offsetSeconds !== b.offsetSeconds) return a.offsetSeconds - b.offsetSeconds
      if (a.start !== b.start) return a.start - b.start
      return a.ordem - b.ordem
    })

  return valid[0]?.slot ?? null
}

