import {
  AudioTrack,
  Book,
  PlanPresetId,
  StudyPlan,
  StudyPlanDay,
  TrackProgress,
} from '../types'
import { addDays, getTodayKey } from './time'

export interface PlanPresetMeta {
  id: Exclude<PlanPresetId, 'custom'>
  name: string
  subtitle: string
  bookIds: string[]
  defaultTracksPerDay: number
  defaultMinutesPerDay: number
  badge: string
}

export const PLAN_PRESETS: PlanPresetMeta[] = [
  {
    id: 'daily-life',
    name: 'Lộ trình Giao tiếp Đời sống (N5 – N3)',
    subtitle: 'Tập trung hội thoại tự nhiên hằng ngày, phản xạ nhanh và phát âm chuẩn.',
    bookIds: [
      'shadowing-shochuukyuu',
      'namachuukei-shochuukyuu-1',
      'namachuukei-shochuukyuu-2',
    ],
    defaultTracksPerDay: 2,
    defaultMinutesPerDay: 20,
    badge: 'Đời sống',
  },
  {
    id: 'work-kaiwa',
    name: 'Lộ trình Công việc & Phỏng vấn (N3 – N1)',
    subtitle: 'Kính ngữ, giao tiếp đồng nghiệp/sếp/khách hàng và phỏng vấn tiếng Nhật.',
    bookIds: [
      'shadowing-mensetsu',
      'shadowing-chuujoukyuu',
      'namachuukei-chuujoukyuu',
    ],
    defaultTracksPerDay: 2,
    defaultMinutesPerDay: 25,
    badge: 'Công việc',
  },
  {
    id: 'full-mastery',
    name: 'Lộ trình Toàn diện 6 cuốn (Cơ bản → Cao cấp)',
    subtitle: 'Đi tuần tự từ nền tảng đời sống đến công sở chuyên sâu & thuyết trình.',
    bookIds: [
      'shadowing-shochuukyuu',
      'namachuukei-shochuukyuu-1',
      'shadowing-mensetsu',
      'namachuukei-shochuukyuu-2',
      'shadowing-chuujoukyuu',
      'namachuukei-chuujoukyuu',
    ],
    defaultTracksPerDay: 2,
    defaultMinutesPerDay: 30,
    badge: 'Toàn diện',
  },
]

export interface GeneratePlanInput {
  books: Book[]
  bookIds: string[]
  preset: PlanPresetId
  name: string
  tracksPerDay: number
  minutesPerDay: number
  startDate?: string
  skipMastered?: boolean
  trackProgress?: Record<string, TrackProgress>
}

export function generateStudyPlan({
  books,
  bookIds,
  preset,
  name,
  tracksPerDay,
  minutesPerDay,
  startDate = getTodayKey(),
  skipMastered = true,
  trackProgress = {},
}: GeneratePlanInput): StudyPlan {
  const safeTracksPerDay = Math.max(1, Math.min(8, Math.round(tracksPerDay)))
  const bookMap = new Map(books.map((b) => [b.id, b]))

  const orderedItems: Array<{ bookTitle: string; track: AudioTrack }> = []
  for (const bId of bookIds) {
    const book = bookMap.get(bId)
    if (!book) continue
    for (const sec of book.sections) {
      for (const track of sec.tracks) {
        const st = trackProgress[track.id]?.status
        if (skipMastered && st === 'mastered') continue
        orderedItems.push({ bookTitle: book.title, track })
      }
    }
  }

  const days: StudyPlanDay[] = []
  const totalNewDays = Math.ceil(orderedItems.length / safeTracksPerDay)

  for (let d = 0; d < totalNewDays; d += 1) {
    const slice = orderedItems.slice(d * safeTracksPerDay, (d + 1) * safeTracksPerDay)
    const newTrackIds = slice.map((item) => item.track.id)

    // Interleave spaced reviews from D-1, D-3, D-7 (capped at 4 reviews/day)
    const reviewSet = new Set<string>()
    for (const lag of [1, 3, 7]) {
      const prevIdx = d - lag
      if (prevIdx >= 0 && days[prevIdx]) {
        for (const tid of days[prevIdx].newTrackIds) {
          if (reviewSet.size < 4) reviewSet.add(tid)
        }
      }
    }

    const firstBookName = slice[0]?.bookTitle || ''
    const shortBookName =
      firstBookName.length > 26 ? `${firstBookName.slice(0, 26)}…` : firstBookName

    days.push({
      dayNumber: d + 1,
      dateKey: addDays(startDate, d),
      title: shortBookName ? `Ngày ${d + 1} · ${shortBookName}` : `Ngày ${d + 1}`,
      newTrackIds,
      reviewTrackIds: Array.from(reviewSet),
      completedTrackIds: [],
    })
  }

  return {
    id: `plan-${Date.now()}`,
    name: name.trim() || 'Kế hoạch luyện Shadowing',
    preset,
    bookIds,
    tracksPerDay: safeTracksPerDay,
    minutesPerDay: Math.max(10, Math.round(minutesPerDay)),
    startDate,
    createdAt: new Date().toISOString(),
    days,
  }
}

export function isPlanDayComplete(day: StudyPlanDay): boolean {
  const required = [...day.newTrackIds, ...day.reviewTrackIds]
  if (required.length === 0) return true
  const doneSet = new Set(day.completedTrackIds)
  return required.every((id) => doneSet.has(id))
}

export function getTodayPlanDay(
  plan: StudyPlan | null,
  todayKey = getTodayKey()
): StudyPlanDay | null {
  if (!plan || plan.days.length === 0) return null
  const exact = plan.days.find((d) => d.dateKey === todayKey)
  if (exact) return exact
  const firstIncomplete = plan.days.find((d) => !isPlanDayComplete(d))
  return firstIncomplete || plan.days[plan.days.length - 1]
}

export function shiftPlanToToday(plan: StudyPlan, todayKey = getTodayKey()): StudyPlan {
  const firstIncompleteIdx = plan.days.findIndex((d) => !isPlanDayComplete(d))
  if (firstIncompleteIdx === -1) return plan

  let offset = 0
  const nextDays = plan.days.map((day, idx) => {
    if (idx < firstIncompleteIdx) return day
    const nextDateKey = addDays(todayKey, offset)
    offset += 1
    return {
      ...day,
      dateKey: nextDateKey,
    }
  })

  return {
    ...plan,
    days: nextDays,
  }
}

export function markTrackCompletedInPlan(
  plan: StudyPlan | null,
  trackId: string,
  todayKey = getTodayKey()
): StudyPlan | null {
  if (!plan) return null
  const targetDay = getTodayPlanDay(plan, todayKey)
  let changed = false

  const nextDays = plan.days.map((day) => {
    const containsTrack =
      day.newTrackIds.includes(trackId) || day.reviewTrackIds.includes(trackId)
    const isTarget = targetDay ? day.dayNumber === targetDay.dayNumber : false
    if (!containsTrack && !isTarget) return day
    if (!containsTrack) return day
    if (day.completedTrackIds.includes(trackId)) return day
    changed = true
    return {
      ...day,
      completedTrackIds: [...day.completedTrackIds, trackId],
    }
  })

  return changed ? { ...plan, days: nextDays } : plan
}
