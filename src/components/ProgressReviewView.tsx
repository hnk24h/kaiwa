import React, { useMemo, useState } from 'react'
import {
  ABPreset,
  AudioTrack,
  Book,
  KaiwaNote,
  ReviewRating,
  ShadowingStep,
  StudyState,
} from '../types'
import {
  SRS_INTERVALS,
  getDueReviewItems,
  getUpcomingReviewItems,
} from '../utils/srs'
import {
  computeStreak,
  formatFullDate,
  formatShortDate,
  formatTime,
  getLastNDays,
  getTodayKey,
} from '../utils/time'
import {
  Award,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Flame,
  NotebookPen,
  Play,
  Repeat,
  RotateCcw,
  Search,
} from 'lucide-react'

interface ProgressReviewViewProps {
  books: Book[]
  state: StudyState
  onRateReview: (trackId: string, rating: ReviewRating) => void
  onOpenTrack: (
    book: Book,
    trackId: string,
    pdfPage?: number,
    pdfKind?: 'main' | 'kaitou',
    initialStep?: ShadowingStep
  ) => void
}

export const ProgressReviewView: React.FC<ProgressReviewViewProps> = ({
  books,
  state,
  onRateReview,
  onOpenTrack,
}) => {
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [vaultTab, setVaultTab] = useState<'notes' | 'ab'>('notes')
  const [vaultBookFilter, setVaultBookFilter] = useState<string>('all')
  const [vaultSearch, setVaultSearch] = useState('')
  const [hideMeanings, setHideMeanings] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})

  const todayKey = getTodayKey()
  const goalMinutes = state.settings.dailyGoalMinutes || 20
  const streak = useMemo(() => computeStreak(state.dailyMinutes), [state.dailyMinutes])

  const kpis = useMemo(() => {
    const totalMinutes = Object.values(state.dailyMinutes).reduce((acc, v) => acc + v, 0)
    let totalTracks = 0
    let mastered = 0
    let learning = 0
    let totalPlays = 0
    let totalLoops = 0

    for (const b of books) {
      for (const s of b.sections) {
        for (const t of s.tracks) {
          totalTracks += 1
          const p = state.trackProgress[t.id]
          if (p) {
            if (p.status === 'mastered') mastered += 1
            else if (p.status === 'learning') learning += 1
            totalPlays += p.playCount || 0
            totalLoops += p.loopCount || 0
          }
        }
      }
    }

    const totalNotes = Object.values(state.notes).reduce((acc, arr) => acc + arr.length, 0)
    return {
      totalMinutes: Math.round(totalMinutes),
      totalTracks,
      mastered,
      learning,
      totalPlays,
      totalLoops,
      totalNotes,
    }
  }, [books, state.dailyMinutes, state.trackProgress, state.notes])

  const last14Days = useMemo(() => {
    const keys = getLastNDays(14, todayKey)
    const maxMin = Math.max(goalMinutes, ...keys.map((k) => state.dailyMinutes[k] || 0), 10)
    return keys.map((k) => {
      const mins = Math.round((state.dailyMinutes[k] || 0) * 10) / 10
      return {
        dateKey: k,
        label: formatShortDate(k),
        minutes: mins,
        heightPct: Math.min(100, Math.round((mins / maxMin) * 100)),
        reachedGoal: mins >= goalMinutes,
      }
    })
  }, [todayKey, goalMinutes, state.dailyMinutes])

  const dueReviews = useMemo(
    () => getDueReviewItems(books, state.trackProgress, todayKey),
    [books, state.trackProgress, todayKey]
  )

  const upcomingReviews = useMemo(
    () => getUpcomingReviewItems(books, state.trackProgress, todayKey, 7),
    [books, state.trackProgress, todayKey]
  )

  const trackLookup = useMemo(() => {
    const map = new Map<string, { book: Book; track: AudioTrack }>()
    for (const b of books) {
      for (const s of b.sections) {
        for (const t of s.tracks) {
          map.set(t.id, { book: b, track: t })
        }
      }
    }
    return map
  }, [books])

  const allNotes = useMemo(() => {
    const list: Array<{ book: Book; track: AudioTrack; note: KaiwaNote }> = []
    for (const [trackId, notes] of Object.entries(state.notes)) {
      const found = trackLookup.get(trackId)
      if (!found) continue
      for (const note of notes) {
        list.push({ book: found.book, track: found.track, note })
      }
    }
    list.sort((a, b) => b.note.createdAt.localeCompare(a.note.createdAt))
    return list
  }, [state.notes, trackLookup])

  const allAbPresets = useMemo(() => {
    const list: Array<{ book: Book; track: AudioTrack; preset: ABPreset }> = []
    for (const [trackId, presets] of Object.entries(state.abPresets)) {
      const found = trackLookup.get(trackId)
      if (!found) continue
      for (const preset of presets) {
        list.push({ book: found.book, track: found.track, preset })
      }
    }
    list.sort((a, b) => b.preset.createdAt.localeCompare(a.preset.createdAt))
    return list
  }, [state.abPresets, trackLookup])

  const filteredNotes = useMemo(() => {
    const q = vaultSearch.trim().toLowerCase()
    return allNotes.filter((item) => {
      if (vaultBookFilter !== 'all' && item.book.id !== vaultBookFilter) return false
      if (!q) return true
      return (
        item.note.jpText.toLowerCase().includes(q) ||
        item.note.meaning.toLowerCase().includes(q) ||
        item.track.title.toLowerCase().includes(q)
      )
    })
  }, [allNotes, vaultBookFilter, vaultSearch])

  const filteredPresets = useMemo(() => {
    const q = vaultSearch.trim().toLowerCase()
    return allAbPresets.filter((item) => {
      if (vaultBookFilter !== 'all' && item.book.id !== vaultBookFilter) return false
      if (!q) return true
      return (
        item.preset.label.toLowerCase().includes(q) ||
        item.track.title.toLowerCase().includes(q)
      )
    })
  }, [allAbPresets, vaultBookFilter, vaultSearch])

  function openTrackItem(book: Book, track: AudioTrack, step?: ShadowingStep) {
    const pdfKind = book.kaitouPdfUrl ? book.defaultPdfKind || 'main' : 'main'
    const prog = state.trackProgress[track.id]
    const page =
      pdfKind === 'kaitou'
        ? prog?.kaitouPage ?? track.defaultKaitouPage ?? track.defaultPdfPage ?? 1
        : prog?.pdfPage ?? track.defaultPdfPage ?? 1
    onOpenTrack(book, track.id, page, pdfKind, step)
  }

  function openNextUnmasteredTrack(book: Book) {
    const allTracks = book.sections.flatMap((s) => s.tracks)
    const nextTrack =
      allTracks.find((t) => state.trackProgress[t.id]?.status !== 'mastered') || allTracks[0]
    if (nextTrack) {
      openTrackItem(book, nextTrack)
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
            <span>Tổng thời gian luyện</span>
            <Clock className="h-4 w-4 text-indigoKaiwa" />
          </div>
          <p className="mt-2 text-2xl font-bold">{kpis.totalMinutes} phút</p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
            Mục tiêu ngày: {goalMinutes} phút
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
            <span>Chuỗi ngày liên tiếp</span>
            <Flame className="h-4 w-4 text-vermilion" />
          </div>
          <p className="mt-2 text-2xl font-bold">{streak} ngày</p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
            Hôm nay: {Math.round((state.dailyMinutes[todayKey] || 0) * 10) / 10} phút
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
            <span>Tiến độ bài học</span>
            <Award className="h-4 w-4 text-matcha" />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {kpis.mastered}{' '}
            <span className="text-sm font-normal text-stone-500 dark:text-slate-400">
              / {kpis.totalTracks}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
            {kpis.learning} bài đang luyện
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
            <span>Lượt Shadowing & Ghi chú</span>
            <Repeat className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{kpis.totalPlays + kpis.totalLoops}</p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
            {kpis.totalNotes} cụm câu Kaiwa đã lưu
          </p>
        </div>
      </section>

      {/* 14-Day Chart + Per-Book Progress */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* 14-day Bar Chart */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Lịch sử luyện nói 14 ngày gần nhất</h2>
            <span className="text-[11px] text-stone-500 dark:text-slate-400">
              Mục tiêu: {goalMinutes}p
            </span>
          </div>

          <div className="mt-5 flex h-44 items-end gap-1.5 border-b border-stone-200 pb-2 dark:border-slate-700">
            {last14Days.map((day) => (
              <div
                key={day.dateKey}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                title={`${formatFullDate(day.dateKey)}: ${day.minutes} phút`}
              >
                <span className="mb-1 hidden text-[10px] font-semibold text-stone-500 group-hover:block dark:text-slate-300">
                  {day.minutes}p
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    day.minutes === 0
                      ? 'h-1 bg-stone-200 dark:bg-slate-800'
                      : day.reachedGoal
                        ? 'bg-matcha'
                        : 'bg-indigoKaiwa'
                  }`}
                  style={{
                    height: day.minutes > 0 ? `${Math.max(8, day.heightPct)}%` : '4px',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-stone-400">
            <span>{last14Days[0]?.label}</span>
            <span>{last14Days[6]?.label}</span>
            <span>Hôm nay ({last14Days[13]?.label})</span>
          </div>

          <div className="mt-4 flex items-center gap-4 text-[11px] text-stone-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-matcha" /> Đạt mục tiêu ({goalMinutes}p+)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigoKaiwa" /> Có luyện tập
            </span>
          </div>
        </div>

        {/* Per-Book Progress */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold">Tiến độ chi tiết từng cuốn sách</h2>
          <div className="mt-3 space-y-3">
            {books.map((book) => {
              const tracks = book.sections.flatMap((s) => s.tracks)
              const mastered = tracks.filter(
                (t) => state.trackProgress[t.id]?.status === 'mastered'
              ).length
              const learning = tracks.filter(
                (t) => state.trackProgress[t.id]?.status === 'learning'
              ).length
              const total = tracks.length || 1
              const masteredPct = Math.round((mastered / total) * 100)
              const learningPct = Math.round((learning / total) * 100)

              return (
                <div
                  key={book.id}
                  className="rounded-xl border border-stone-200/80 p-3 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-jp truncate text-xs font-bold">{book.title}</p>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400">
                        {mastered} thành thạo · {learning} đang luyện · {tracks.length} bài ({masteredPct}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openNextUnmasteredTrack(book)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigoKaiwa hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Học tiếp bài kế
                    </button>
                  </div>

                  <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
                    <div
                      className="h-full bg-matcha transition-all"
                      style={{ width: `${masteredPct}%` }}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${learningPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SRS Spaced Repetition Review Queue */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold">
              <RotateCcw className="h-5 w-5 text-vermilion" />
              Ôn tập ngắt quãng hôm nay (Spaced Repetition)
              {dueReviews.length > 0 && (
                <span className="rounded-full bg-vermilion px-2.5 py-0.5 text-xs font-bold text-white">
                  {dueReviews.length} bài đến hạn
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
              Chu kỳ nhắc lại tự động: <strong>1 → 3 → 7 → 14 → 30 → 60 ngày</strong>. Hãy thử <strong>Ôn mù</strong> rồi đánh giá mức độ trôi chảy.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowUpcoming((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300"
          >
            <span>Lịch ôn 7 ngày tới ({upcomingReviews.length})</span>
            {showUpcoming ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {dueReviews.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-center text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="mx-auto h-6 w-6 text-matcha" />
            <p className="mt-1.5 font-bold">Tuyệt vời! Bạn không còn bài nào quá hạn ôn tập hôm nay.</p>
            <p className="mt-0.5 opacity-80">
              Mỗi khi bạn hoàn thành một bài mới trong Studio, hệ thống sẽ tự lên lịch ôn lại vào ngày mai.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {dueReviews.map((item) => {
              const stage = item.progress.reviewStage ?? 0
              const nextGoodDays =
                SRS_INTERVALS[Math.min(stage + 1, SRS_INTERVALS.length - 1)]
              const page =
                item.book.defaultPdfKind === 'kaitou'
                  ? item.track.defaultKaitouPage ?? item.track.defaultPdfPage
                  : item.track.defaultPdfPage

              return (
                <div
                  key={item.track.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 md:flex-row md:items-center dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-white px-2 py-0.5 font-semibold text-stone-700 shadow-sm dark:bg-slate-700 dark:text-slate-200">
                        {item.book.title}
                      </span>
                      {page && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigoKaiwa dark:bg-indigo-950 dark:text-indigo-300">
                          Tr.{page}
                        </span>
                      )}
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Mức {stage + 1}/{SRS_INTERVALS.length}
                      </span>
                      {item.overdueDays > 0 && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-vermilion dark:bg-red-950 dark:text-red-300">
                          Trễ {item.overdueDays} ngày
                        </span>
                      )}
                    </div>
                    <p className="font-jp truncate text-sm font-bold">{item.track.title}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => openTrackItem(item.book, item.track)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Luyện lại
                    </button>
                    <button
                      type="button"
                      onClick={() => openTrackItem(item.book, item.track, 4)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigoKaiwa px-2.5 py-1.5 font-semibold text-white hover:bg-indigo-700"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Ôn mù
                    </button>

                    <div className="mx-1 hidden h-4 w-px bg-stone-300 sm:block dark:bg-slate-600" />

                    <button
                      type="button"
                      onClick={() => onRateReview(item.track.id, 'again')}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 font-semibold text-vermilion hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60"
                    >
                      Còn vấp (1n)
                    </button>
                    <button
                      type="button"
                      onClick={() => onRateReview(item.track.id, 'good')}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                      Tạm ổn ({nextGoodDays}n)
                    </button>
                    <button
                      type="button"
                      onClick={() => onRateReview(item.track.id, 'easy')}
                      className="rounded-lg bg-matcha px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700"
                    >
                      Trôi chảy ✓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showUpcoming && (
          <div className="mt-4 border-t border-stone-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-bold text-stone-600 dark:text-slate-300">
              Các bài sắp đến hạn trong 7 ngày tới
            </p>
            {upcomingReviews.length === 0 ? (
              <p className="mt-2 text-xs text-stone-400">Chưa có bài nào trong 7 ngày tới.</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingReviews.map((item) => (
                  <button
                    key={item.track.id}
                    type="button"
                    onClick={() => openTrackItem(item.book, item.track)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 p-2.5 text-left text-xs hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="font-jp truncate font-semibold">{item.track.title}</p>
                      <p className="truncate text-[11px] text-stone-500 dark:text-slate-400">
                        {item.book.title}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-600 dark:bg-slate-800 dark:text-slate-300">
                      {formatShortDate(item.dueDate)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Aggregated Kaiwa Vault & Difficult A-B Loops */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVaultTab('notes')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                vaultTab === 'notes'
                  ? 'bg-indigoKaiwa text-white'
                  : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Sổ tay câu Kaiwa ({allNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setVaultTab('ab')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                vaultTab === 'ab'
                  ? 'bg-indigoKaiwa text-white'
                  : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Đoạn A–B khó ({allAbPresets.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {vaultTab === 'notes' && (
              <button
                type="button"
                onClick={() => {
                  setHideMeanings((v) => !v)
                  setRevealedIds({})
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold ${
                  hideMeanings
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'border-stone-200 text-stone-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {hideMeanings ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {hideMeanings ? 'Đang che nghĩa (bấm thẻ để xem)' : 'Che nghĩa để tự nhẩm'}
              </button>
            )}

            <select
              value={vaultBookFilter}
              onChange={(e) => setVaultBookFilter(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">Tất cả sách</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                placeholder="Tìm câu / từ khóa..."
                className="rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigoKaiwa focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        </div>

        {vaultTab === 'notes' ? (
          filteredNotes.length === 0 ? (
            <p className="py-8 text-center text-xs text-stone-400">
              Chưa có câu Kaiwa nào được ghi chú. Khi luyện trong Studio, hãy dùng tab{' '}
              <strong>Kaiwa</strong> bên phải để lưu các câu giao tiếp đắt giá!
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredNotes.map(({ book, track, note }) => {
                const masked = hideMeanings && !revealedIds[note.id]
                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      if (hideMeanings) {
                        setRevealedIds((prev) => ({ ...prev, [note.id]: !prev[note.id] }))
                      }
                    }}
                    className={`flex flex-col justify-between rounded-xl border border-stone-200 p-3.5 text-xs dark:border-slate-700 ${
                      hideMeanings ? 'cursor-pointer hover:border-indigoKaiwa' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-slate-400">
                        <span className="truncate">{book.title}</span>
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 font-mono font-semibold text-matcha dark:bg-emerald-950/60 dark:text-emerald-300">
                          {formatTime(note.timeSec)}
                        </span>
                      </div>
                      <p className="font-jp mt-2 text-sm font-bold">{note.jpText}</p>
                      {note.meaning && (
                        <p
                          className={`mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300 ${
                            masked ? 'select-none blur-sm' : ''
                          }`}
                        >
                          {note.meaning}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 dark:border-slate-800">
                      <span className="truncate text-[11px] text-stone-400">{track.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openTrackItem(book, track)
                        }}
                        className="shrink-0 font-semibold text-indigoKaiwa hover:underline dark:text-indigo-300"
                      >
                        Mở bài & nghe lại →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : filteredPresets.length === 0 ? (
          <p className="py-8 text-center text-xs text-stone-400">
            Chưa có đoạn A–B nào được lưu. Khi gặp câu nói nhanh khó bắt nhịp, hãy đặt A–B và bấm{' '}
            <strong>Lưu A–B</strong> để gom lại đây ôn tập.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredPresets.map(({ book, track, preset }) => (
              <div
                key={preset.id}
                className="flex flex-col justify-between rounded-xl border border-stone-200 p-3.5 text-xs dark:border-slate-700"
              >
                <div>
                  <span className="text-[11px] text-stone-500 dark:text-slate-400">
                    {book.title}
                  </span>
                  <p className="mt-1 text-sm font-bold">{preset.label}</p>
                  <p className="mt-1 font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {formatTime(preset.a)} → {formatTime(preset.b)} ({Math.round(preset.b - preset.a)}s)
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 dark:border-slate-800">
                  <span className="truncate text-[11px] text-stone-400">{track.title}</span>
                  <button
                    type="button"
                    onClick={() => openTrackItem(book, track)}
                    className="shrink-0 font-semibold text-indigoKaiwa hover:underline dark:text-indigo-300"
                  >
                    Mở bài →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
