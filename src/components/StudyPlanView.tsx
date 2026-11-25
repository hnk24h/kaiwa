import React, { useMemo, useState } from 'react'
import {
  AudioTrack,
  Book,
  PlanPresetId,
  ShadowingStep,
  StudyPlan,
  StudyState,
} from '../types'
import {
  PLAN_PRESETS,
  generateStudyPlan,
  getTodayPlanDay,
  isPlanDayComplete,
} from '../utils/studyPlan'
import { addDays, formatFullDate, formatShortDate, getTodayKey } from '../utils/time'
import {
  CalendarCheck2,
  CalendarPlus,
  Check,
  CheckCircle2,
  Circle,
  EyeOff,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'

interface StudyPlanViewProps {
  books: Book[]
  state: StudyState
  onSavePlan: (plan: StudyPlan | null) => void
  onShiftPlanToToday: () => void
  onTogglePlanTrack: (dayNumber: number, trackId: string) => void
  onOpenTrack: (
    book: Book,
    trackId: string,
    pdfPage?: number,
    pdfKind?: 'main' | 'kaitou',
    initialStep?: ShadowingStep
  ) => void
}

export const StudyPlanView: React.FC<StudyPlanViewProps> = ({
  books,
  state,
  onSavePlan,
  onShiftPlanToToday,
  onTogglePlanTrack,
  onOpenTrack,
}) => {
  const plan = state.studyPlan
  const [builderOpen, setBuilderOpen] = useState(!plan)

  // Builder form state
  const [selectedPreset, setSelectedPreset] = useState<PlanPresetId>('daily-life')
  const [planName, setPlanName] = useState(PLAN_PRESETS[0].name)
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>(PLAN_PRESETS[0].bookIds)
  const [tracksPerDay, setTracksPerDay] = useState<number>(2)
  const [minutesPerDay, setMinutesPerDay] = useState<number>(20)
  const [startDate, setStartDate] = useState<string>(getTodayKey())
  const [skipMastered, setSkipMastered] = useState<boolean>(true)
  const [dayFilter, setDayFilter] = useState<'all' | 'pending' | 'done'>('all')

  const trackLookup = useMemo(() => {
    const map = new Map<string, { book: Book; track: AudioTrack }>()
    for (const book of books) {
      for (const sec of book.sections) {
        for (const t of sec.tracks) {
          map.set(t.id, { book, track: t })
        }
      }
    }
    return map
  }, [books])

  const previewStats = useMemo(() => {
    let totalTracks = 0
    for (const bId of selectedBookIds) {
      const b = books.find((x) => x.id === bId)
      if (!b) continue
      for (const sec of b.sections) {
        for (const t of sec.tracks) {
          if (skipMastered && state.trackProgress[t.id]?.status === 'mastered') continue
          totalTracks += 1
        }
      }
    }
    const totalDays = Math.max(1, Math.ceil(totalTracks / Math.max(1, tracksPerDay)))
    const endDate = addDays(startDate, totalDays - 1)
    return { totalTracks, totalDays, endDate }
  }, [books, selectedBookIds, skipMastered, state.trackProgress, tracksPerDay, startDate])

  function handleSelectPreset(presetId: Exclude<PlanPresetId, 'custom'>) {
    const preset = PLAN_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setSelectedPreset(preset.id)
    setPlanName(preset.name)
    setSelectedBookIds(preset.bookIds.filter((id) => books.some((b) => b.id === id)))
    setTracksPerDay(preset.defaultTracksPerDay)
    setMinutesPerDay(preset.defaultMinutesPerDay)
  }

  function toggleBookSelection(bookId: string) {
    setSelectedPreset('custom')
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    )
  }

  function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault()
    if (selectedBookIds.length === 0) return
    const nextPlan = generateStudyPlan({
      books,
      bookIds: selectedBookIds,
      preset: selectedPreset,
      name: planName,
      tracksPerDay,
      minutesPerDay,
      startDate,
      skipMastered,
      trackProgress: state.trackProgress,
    })
    onSavePlan(nextPlan)
    setBuilderOpen(false)
  }

  function launchTrack(trackId: string, step?: ShadowingStep) {
    const found = trackLookup.get(trackId)
    if (!found) return
    const { book, track } = found
    const pdfKind = book.kaitouPdfUrl ? book.defaultPdfKind || 'main' : 'main'
    const prog = state.trackProgress[track.id]
    const page =
      pdfKind === 'kaitou'
        ? prog?.kaitouPage ?? track.defaultKaitouPage ?? track.defaultPdfPage ?? 1
        : prog?.pdfPage ?? track.defaultPdfPage ?? 1
    onOpenTrack(book, track.id, page, pdfKind, step)
  }

  const todayKey = getTodayKey()
  const todayPlanDay = useMemo(() => getTodayPlanDay(plan, todayKey), [plan, todayKey])

  const planStats = useMemo(() => {
    if (!plan) return { doneDays: 0, totalDays: 0, doneTracks: 0, totalTracks: 0 }
    let doneDays = 0
    let doneTracks = 0
    let totalTracks = 0
    for (const d of plan.days) {
      if (isPlanDayComplete(d)) doneDays += 1
      const req = new Set([...d.newTrackIds, ...d.reviewTrackIds])
      totalTracks += req.size
      for (const tid of d.completedTrackIds) {
        if (req.has(tid)) doneTracks += 1
      }
    }
    return { doneDays, totalDays: plan.days.length, doneTracks, totalTracks }
  }, [plan])

  const filteredDays = useMemo(() => {
    if (!plan) return []
    return plan.days.filter((d) => {
      const done = isPlanDayComplete(d)
      if (dayFilter === 'pending') return !done
      if (dayFilter === 'done') return done
      return true
    })
  }, [plan, dayFilter])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Builder Panel */}
      {(builderOpen || !plan) && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold">
                <CalendarPlus className="h-5 w-5 text-indigoKaiwa" />
                {plan ? 'Tạo lại lộ trình học Shadowing mới' : 'Thiết lập lộ trình tự học Kaiwa'}
              </h2>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
                Chọn mục tiêu học, hệ thống sẽ tự chia bài theo ngày và xen kẽ lịch ôn lại sau 1 – 3 – 7 ngày.
              </p>
            </div>
            {plan && (
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300"
              >
                Quay lại kế hoạch hiện tại
              </button>
            )}
          </div>

          <form onSubmit={handleCreatePlan} className="mt-4 space-y-5">
            {/* 3 Preset Cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PLAN_PRESETS.map((preset) => {
                const active = selectedPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-indigoKaiwa bg-indigo-50/70 ring-2 ring-indigoKaiwa/20 dark:border-indigo-500 dark:bg-indigo-950/40'
                        : 'border-stone-200 bg-white hover:border-stone-300 dark:border-slate-700 dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigoKaiwa dark:bg-indigo-950 dark:text-indigo-300">
                        {preset.badge}
                      </span>
                      {active && <CheckCircle2 className="h-4 w-4 text-indigoKaiwa" />}
                    </div>
                    <h3 className="mt-2 text-sm font-bold">{preset.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
                      {preset.subtitle}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-stone-600 dark:text-slate-300">
                      {preset.bookIds.length} cuốn · {preset.defaultTracksPerDay} bài/ngày · {preset.defaultMinutesPerDay} phút
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Book Checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                Chọn sách đưa vào lộ trình ({selectedBookIds.length}/{books.length} cuốn)
              </label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {books.map((book) => {
                  const checked = selectedBookIds.includes(book.id)
                  return (
                    <label
                      key={book.id}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 text-xs transition ${
                        checked
                          ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/30'
                          : 'border-stone-200 bg-stone-50/50 dark:border-slate-700 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-jp truncate font-semibold">{book.title}</p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400">
                          {book.level} · {book.totalTracks} bài
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBookSelection(book.id)}
                        className="h-4 w-4 shrink-0 accent-indigoKaiwa"
                      />
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                  Tên kế hoạch
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                  Số bài mới mỗi ngày
                </label>
                <select
                  value={tracksPerDay}
                  onChange={(e) => setTracksPerDay(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} bài mới / ngày (+ ôn tập xen kẽ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                  Thời lượng mục tiêu
                </label>
                <select
                  value={minutesPerDay}
                  onChange={(e) => setMinutesPerDay(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {[15, 20, 25, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {m} phút / ngày
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3.5 dark:bg-slate-800/60">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={skipMastered}
                  onChange={(e) => setSkipMastered(e.target.checked)}
                  className="h-4 w-4 accent-indigoKaiwa"
                />
                <span>Bỏ qua các bài đã đánh dấu &ldquo;Thành thạo&rdquo;</span>
              </label>

              <div className="text-xs font-semibold text-indigoKaiwa dark:text-indigo-300">
                Dự kiến: {previewStats.totalTracks} bài · {previewStats.totalDays} ngày (đến{' '}
                {formatFullDate(previewStats.endDate)})
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={selectedBookIds.length === 0 || previewStats.totalTracks === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigoKaiwa px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                Tạo lộ trình học ngay
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Active Plan Dashboard */}
      {plan && !builderOpen && (
        <>
          {/* Plan Summary Header */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigoKaiwa dark:bg-indigo-950/70 dark:text-indigo-300">
                  <CalendarCheck2 className="h-3.5 w-3.5" />
                  Kế hoạch đang chạy
                </span>
                <h2 className="mt-1.5 text-lg font-bold">{plan.name}</h2>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
                  {planStats.doneDays}/{planStats.totalDays} ngày hoàn thành ·{' '}
                  {planStats.doneTracks}/{planStats.totalTracks} lượt bài · Mục tiêu{' '}
                  {plan.minutesPerDay} phút/ngày
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onShiftPlanToToday}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  title="Nếu bạn bị trễ vài ngày, bấm để dời bài chưa xong gần nhất về ngày hôm nay"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Dời bài chưa xong về hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Đổi lộ trình
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bạn muốn xóa kế hoạch học hiện tại?')) {
                      onSavePlan(null)
                      setBuilderOpen(true)
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-matcha transition-all"
                style={{
                  width: `${
                    planStats.totalDays > 0
                      ? Math.round((planStats.doneDays / planStats.totalDays) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </section>

          {/* Today's Mission Card */}
          {todayPlanDay && (
            <section className="rounded-2xl border-2 border-indigoKaiwa/30 bg-white p-5 shadow-sm dark:border-indigo-700/60 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigoKaiwa dark:text-indigo-300">
                    Nhiệm vụ hôm nay ({formatFullDate(todayPlanDay.dateKey)})
                  </span>
                  <h3 className="mt-0.5 text-base font-bold">{todayPlanDay.title}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    isPlanDayComplete(todayPlanDay)
                      ? 'bg-emerald-100 text-matcha dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {isPlanDayComplete(todayPlanDay) ? 'Đã xong hôm nay ✓' : 'Đang thực hiện'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* New tracks */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-stone-600 dark:text-slate-300">
                    Bài mới hôm nay ({todayPlanDay.newTrackIds.length})
                  </p>
                  {todayPlanDay.newTrackIds.map((tid) => {
                    const info = trackLookup.get(tid)
                    if (!info) return null
                    const done = todayPlanDay.completedTrackIds.includes(tid)
                    const page =
                      info.book.defaultPdfKind === 'kaitou'
                        ? info.track.defaultKaitouPage ?? info.track.defaultPdfPage
                        : info.track.defaultPdfPage
                    return (
                      <div
                        key={tid}
                        className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <button
                          type="button"
                          onClick={() => onTogglePlanTrack(todayPlanDay.dayNumber, tid)}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-matcha" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-stone-400" />
                          )}
                          <div className="min-w-0">
                            <p
                              className={`font-jp truncate text-xs font-semibold ${
                                done ? 'line-through opacity-60' : ''
                              }`}
                            >
                              {info.track.title}
                            </p>
                            <p className="truncate text-[11px] text-stone-500 dark:text-slate-400">
                              {info.book.title} {page ? `· Tr.${page}` : ''}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => launchTrack(tid)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigoKaiwa px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Học ngay
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Review tracks */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-stone-600 dark:text-slate-300">
                    Ôn lại bài cũ trong lộ trình ({todayPlanDay.reviewTrackIds.length})
                  </p>
                  {todayPlanDay.reviewTrackIds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-200 p-4 text-xs text-stone-400 dark:border-slate-700">
                      Ngày đầu tiên chưa có bài cũ cần ôn. Từ ngày thứ 2 trở đi hệ thống sẽ tự nhắc ôn lại bài của 1, 3 và 7 ngày trước!
                    </div>
                  ) : (
                    todayPlanDay.reviewTrackIds.map((tid) => {
                      const info = trackLookup.get(tid)
                      if (!info) return null
                      const done = todayPlanDay.completedTrackIds.includes(tid)
                      return (
                        <div
                          key={tid}
                          className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
                        >
                          <button
                            type="button"
                            onClick={() => onTogglePlanTrack(todayPlanDay.dayNumber, tid)}
                            className="flex min-w-0 items-center gap-2 text-left"
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-matcha" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-amber-500" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`font-jp truncate text-xs font-semibold ${
                                  done ? 'line-through opacity-60' : ''
                                }`}
                              >
                                {info.track.title}
                              </p>
                              <p className="truncate text-[11px] text-stone-500 dark:text-slate-400">
                                {info.book.title}
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => launchTrack(tid, 4)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-vermilion px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            title="Mở ở chế độ làm mờ PDF + Thu âm để kiểm tra phản xạ"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            Ôn mù
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Full Schedule Timeline */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold">Lịch trình toàn bộ ({plan.days.length} ngày)</h3>
              <div className="flex gap-1 rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                {(
                  [
                    { id: 'all', label: 'Tất cả' },
                    { id: 'pending', label: 'Chưa xong' },
                    { id: 'done', label: 'Đã xong' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDayFilter(tab.id)}
                    className={`rounded-md px-3 py-1 font-semibold ${
                      dayFilter === tab.id
                        ? 'bg-white text-indigoKaiwa shadow-sm dark:bg-slate-700 dark:text-white'
                        : 'text-stone-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
              {filteredDays.slice(0, 60).map((day) => {
                const complete = isPlanDayComplete(day)
                const isToday = day.dateKey === todayKey
                return (
                  <div
                    key={day.dayNumber}
                    className={`rounded-xl border p-3 text-xs ${
                      isToday
                        ? 'border-indigoKaiwa bg-indigo-50/40 dark:border-indigo-600 dark:bg-indigo-950/30'
                        : complete
                          ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/15'
                          : 'border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                            isToday
                              ? 'bg-indigoKaiwa text-white'
                              : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {formatShortDate(day.dateKey)}
                        </span>
                        <span className="font-bold">{day.title}</span>
                      </div>
                      <span className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
                        {day.completedTrackIds.length}/
                        {day.newTrackIds.length + day.reviewTrackIds.length} bài
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {day.newTrackIds.map((tid) => {
                        const info = trackLookup.get(tid)
                        if (!info) return null
                        const done = day.completedTrackIds.includes(tid)
                        return (
                          <div
                            key={`new-${tid}`}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                              done
                                ? 'border-emerald-300 bg-emerald-50 text-matcha dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'border-stone-200 bg-stone-50 text-stone-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onTogglePlanTrack(day.dayNumber, tid)}
                              title="Đánh dấu hoàn thành"
                            >
                              {done ? (
                                <Check className="h-3 w-3 text-matcha" />
                              ) : (
                                <Circle className="h-3 w-3 text-stone-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => launchTrack(tid)}
                              className="font-jp max-w-[200px] truncate hover:underline"
                            >
                              {info.track.title}
                            </button>
                          </div>
                        )
                      })}

                      {day.reviewTrackIds.map((tid) => {
                        const info = trackLookup.get(tid)
                        if (!info) return null
                        const done = day.completedTrackIds.includes(tid)
                        return (
                          <div
                            key={`rev-${tid}`}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
                              done
                                ? 'border-emerald-300 bg-emerald-50 text-matcha dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onTogglePlanTrack(day.dayNumber, tid)}
                            >
                              {done ? (
                                <Check className="h-3 w-3 text-matcha" />
                              ) : (
                                <Circle className="h-3 w-3 text-amber-500" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => launchTrack(tid, 4)}
                              className="font-jp max-w-[180px] truncate hover:underline"
                            >
                              Ôn: {info.track.title}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {filteredDays.length > 60 && (
                <p className="py-2 text-center text-[11px] text-stone-400">
                  Đang hiển thị 60 ngày đầu tiên trong tổng số {filteredDays.length} ngày.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
