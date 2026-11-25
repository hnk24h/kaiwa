export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function getTodayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

export function addDays(dateKey: string, days: number): string {
  const dt = parseDateKey(dateKey)
  dt.setDate(dt.getDate() + days)
  return getTodayKey(dt)
}

export function diffDays(fromKey: string, toKey: string): number {
  const a = parseDateKey(fromKey)
  const b = parseDateKey(toKey)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function getLastNDays(n: number, endKey = getTodayKey()): string[] {
  const result: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    result.push(addDays(endKey, -i))
  }
  return result
}

export function formatShortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}

export function formatFullDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

export function computeStreak(dailyMinutes: Record<string, number>): number {
  let streak = 0
  const cursor = new Date()
  const todayKey = getTodayKey(cursor)
  // If today has 0 minutes yet, still count streak ending yesterday
  if ((dailyMinutes[todayKey] || 0) <= 0) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (true) {
    const key = getTodayKey(cursor)
    if ((dailyMinutes[key] || 0) > 0) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
