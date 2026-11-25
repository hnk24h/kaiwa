import { AudioTrack, Book, ReviewRating, TrackProgress } from '../types'
import { addDays, diffDays, getTodayKey } from './time'

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60] as const

export interface ReviewItem {
  book: Book
  track: AudioTrack
  progress: TrackProgress
  dueDate: string
  overdueDays: number
}

export function ensureReviewScheduled(
  prog: TrackProgress,
  todayKey = getTodayKey()
): TrackProgress {
  if (prog.nextReviewDate) return prog
  if (prog.status === 'new' && (prog.playCount || 0) === 0 && (prog.loopCount || 0) === 0) {
    return prog
  }
  return {
    ...prog,
    reviewStage: prog.reviewStage ?? 0,
    nextReviewDate: addDays(todayKey, SRS_INTERVALS[0]),
  }
}

export function applyReviewRating(
  prog: TrackProgress | undefined,
  rating: ReviewRating,
  todayKey = getTodayKey()
): TrackProgress {
  const nowIso = new Date().toISOString()
  const base: TrackProgress = prog || {
    status: 'learning',
    playCount: 0,
    loopCount: 0,
    updatedAt: nowIso,
  }
  const currentStage = base.reviewStage ?? 0

  let nextStage = currentStage
  let nextStatus = base.status === 'new' ? 'learning' : base.status

  if (rating === 'again') {
    nextStage = 0
    nextStatus = 'learning'
  } else if (rating === 'good') {
    nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1)
    nextStatus = base.status === 'mastered' ? 'mastered' : 'learning'
  } else {
    nextStage = Math.min(Math.max(currentStage + 2, 2), SRS_INTERVALS.length - 1)
    nextStatus = 'mastered'
  }

  const intervalDays = SRS_INTERVALS[nextStage]
  return {
    ...base,
    status: nextStatus,
    reviewStage: nextStage,
    nextReviewDate: addDays(todayKey, intervalDays),
    lastReviewedAt: nowIso,
    reviewCount: (base.reviewCount || 0) + 1,
    updatedAt: nowIso,
  }
}

function buildTrackLookup(books: Book[]): Map<string, { book: Book; track: AudioTrack }> {
  const map = new Map<string, { book: Book; track: AudioTrack }>()
  for (const book of books) {
    for (const sec of book.sections) {
      for (const track of sec.tracks) {
        map.set(track.id, { book, track })
      }
    }
  }
  return map
}

function inferDueDate(prog: TrackProgress, todayKey: string): string | null {
  if (prog.nextReviewDate) return prog.nextReviewDate
  if (prog.status === 'new' && (prog.playCount || 0) === 0 && (prog.loopCount || 0) === 0) {
    return null
  }
  const updatedDay = prog.updatedAt ? prog.updatedAt.slice(0, 10) : todayKey
  if (updatedDay < todayKey) {
    return addDays(updatedDay, 1)
  }
  return null
}

export function getDueReviewItems(
  books: Book[],
  trackProgress: Record<string, TrackProgress>,
  todayKey = getTodayKey()
): ReviewItem[] {
  const lookup = buildTrackLookup(books)
  const items: ReviewItem[] = []

  for (const [trackId, prog] of Object.entries(trackProgress)) {
    const found = lookup.get(trackId)
    if (!found) continue
    const dueDate = inferDueDate(prog, todayKey)
    if (!dueDate) continue
    if (dueDate <= todayKey) {
      items.push({
        book: found.book,
        track: found.track,
        progress: prog,
        dueDate,
        overdueDays: Math.max(0, diffDays(dueDate, todayKey)),
      })
    }
  }

  items.sort((a, b) => {
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays
    return (a.progress.reviewStage ?? 0) - (b.progress.reviewStage ?? 0)
  })
  return items
}

export function getUpcomingReviewItems(
  books: Book[],
  trackProgress: Record<string, TrackProgress>,
  todayKey = getTodayKey(),
  horizonDays = 7
): ReviewItem[] {
  const lookup = buildTrackLookup(books)
  const horizonDate = addDays(todayKey, horizonDays)
  const items: ReviewItem[] = []

  for (const [trackId, prog] of Object.entries(trackProgress)) {
    const found = lookup.get(trackId)
    if (!found) continue
    const dueDate = inferDueDate(prog, todayKey)
    if (!dueDate) continue
    if (dueDate > todayKey && dueDate <= horizonDate) {
      items.push({
        book: found.book,
        track: found.track,
        progress: prog,
        dueDate,
        overdueDays: diffDays(dueDate, todayKey),
      })
    }
  }

  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return items
}
