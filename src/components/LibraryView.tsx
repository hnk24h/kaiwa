import React, { useMemo, useRef, useState } from 'react'
import {
  Book,
  BookCategory,
  HomeTab,
  MediaMode,
  StudyState,
} from '../types'
import { isDirectoryPickerSupported } from '../utils/localFolderCatalog'
import { getTodayPlanDay, isPlanDayComplete } from '../utils/studyPlan'
import { computeStreak, getTodayKey } from '../utils/time'
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  FolderOpen,
  FolderSync,
  HardDrive,
  Headphones,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

interface LibraryViewProps {
  books: Book[]
  mediaMode: MediaMode
  mediaRoot: string
  mediaRootExists: boolean
  savedFolderName: string | null
  folderPicking: boolean
  state: StudyState
  dueReviewCount: number
  onOpenBook: (book: Book, trackId?: string, pdfPage?: number, pdfKind?: 'main' | 'kaitou') => void
  onOpenSettings: () => void
  onNavigateTab: (tab: HomeTab) => void
  onPickLocalFolder: () => void
  onReconnectSavedFolder: () => void
  onFilesSelected: (files: FileList) => void
}

const FILTER_TABS: Array<{ id: 'all' | BookCategory; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'basic', label: 'Cơ bản – Sơ trung cấp' },
  { id: 'intermediate-advanced', label: 'Trung cấp – Cao cấp' },
  { id: 'business', label: 'Công việc & Phỏng vấn' },
]

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  mediaMode,
  mediaRoot,
  mediaRootExists,
  savedFolderName,
  folderPicking,
  state,
  dueReviewCount,
  onOpenBook,
  onOpenSettings,
  onNavigateTab,
  onPickLocalFolder,
  onReconnectSavedFolder,
  onFilesSelected,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | BookCategory>('all')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pickerSupported = isDirectoryPickerSupported()

  const todayKey = getTodayKey()
  const todayMinutes = Math.round((state.dailyMinutes[todayKey] || 0) * 10) / 10
  const goalMinutes = state.settings.dailyGoalMinutes || 20
  const goalPercent = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100))
  const streak = useMemo(() => computeStreak(state.dailyMinutes), [state.dailyMinutes])

  const { totalTracks, practicedCount, masteredCount } = useMemo(() => {
    let total = 0
    let practiced = 0
    let mastered = 0
    for (const book of books) {
      for (const sec of book.sections) {
        for (const t of sec.tracks) {
          total += 1
          const p = state.trackProgress[t.id]
          if (p) {
            if (p.status === 'mastered') {
              mastered += 1
              practiced += 1
            } else if (p.status === 'learning' || p.playCount > 0) {
              practiced += 1
            }
          }
        }
      }
    }
    return { totalTracks: total, practicedCount: practiced, masteredCount: mastered }
  }, [books, state.trackProgress])

  const lastSessionInfo = useMemo(() => {
    if (!state.lastSession) return null
    const book = books.find((b) => b.id === state.lastSession?.bookId)
    if (!book) return null
    const allTracks = book.sections.flatMap((s) => s.tracks)
    const track = allTracks.find((t) => t.id === state.lastSession?.trackId) || allTracks[0]
    if (!track) return null
    return {
      book,
      track,
      pdfPage: state.lastSession.pdfPage || 1,
      pdfKind: state.lastSession.pdfKind || 'main',
    }
  }, [books, state.lastSession])

  const todayPlanDay = useMemo(
    () => getTodayPlanDay(state.studyPlan, todayKey),
    [state.studyPlan, todayKey]
  )

  const filteredBooks = useMemo(() => {
    if (activeCategory === 'all') return books
    return books.filter((b) => b.category === activeCategory)
  }, [books, activeCategory])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files)
          }
          e.currentTarget.value = ''
        }}
      />

      {/* Local-folder connection hero when on Vercel / static hosting and no folder loaded yet */}
      {mediaMode === 'local-folder' && books.length === 0 && (
        <section className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/50 to-stone-50 p-6 shadow-sm dark:border-indigo-900 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigoKaiwa dark:bg-indigo-950 dark:text-indigo-300">
                <HardDrive className="h-3.5 w-3.5" />
                Chế độ Web Online (Vercel) · Đọc sách trực tiếp từ máy bạn
              </span>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Kết nối thư mục sách PDF &amp; Audio của bạn
              </h2>
              <p className="text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                Hãy trỏ tới thư mục <code className="rounded bg-stone-200/80 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-800">D:\02. Tiếng Nhật\luyennoi</code> trên máy tính. Hệ thống sẽ tự động nhận diện đủ 6 bộ sách, 429 file nghe và tự khớp trang PDF như khi chạy trên máy.
              </p>
              <p className="flex items-center gap-1.5 text-xs text-matcha dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  Toàn bộ file PDF &amp; MP3 được trình duyệt đọc trực tiếp tại chỗ, không upload lên server, bảo mật và mở tức thì kể cả file 126 MB.
                </span>
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 sm:min-w-[270px]">
              {savedFolderName && (
                <button
                  type="button"
                  disabled={folderPicking}
                  onClick={onReconnectSavedFolder}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-matcha px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {folderPicking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderSync className="h-4 w-4" />
                  )}
                  Kết nối lại &ldquo;{savedFolderName}&rdquo;
                </button>
              )}

              <button
                type="button"
                disabled={folderPicking}
                onClick={() => {
                  if (pickerSupported) onPickLocalFolder()
                  else fileInputRef.current?.click()
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigoKaiwa px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {folderPicking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
                {savedFolderName ? 'Chọn thư mục khác...' : 'Chọn thư mục sách trên máy'}
              </button>

              {pickerSupported && (
                <button
                  type="button"
                  disabled={folderPicking}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Chọn thư mục (chế độ tương thích)
                </button>
              )}

              <button
                type="button"
                onClick={onOpenSettings}
                className="text-center text-[11px] font-medium text-indigoKaiwa hover:underline dark:text-indigo-300"
              >
                Hoặc kết nối tới Server Media cục bộ / từ xa trong Cài đặt
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Missing folder alert for Server mode */}
      {mediaMode === 'server' && !mediaRootExists && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold">
              Không tìm thấy thư mục sách &amp; audio:{' '}
              <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs dark:bg-red-900/60">
                {mediaRoot}
              </code>
            </p>
            <p className="mt-1 text-xs opacity-90">
              Kiểm tra ổ đĩa đã gắn (trên Windows là <code>D:\02. Tiếng Nhật\luyennoi</code>, trên WSL là{' '}
              <code>/mnt/d/02. Tiếng Nhật/luyennoi</code>) hoặc cập nhật đường dẫn trong Cài đặt.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="shrink-0 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Đổi thư mục
          </button>
        </div>
      )}

      {/* Continue Studying Banner */}
      {lastSessionInfo && (
        <section className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-600 via-indigoKaiwa to-blue-600 p-5 text-white shadow-md dark:border-indigo-900">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Học tiếp phiên gần nhất
              </span>
              <h2 className="font-jp text-lg font-bold sm:text-xl">
                {lastSessionInfo.book.title}
              </h2>
              <p className="text-sm text-indigo-100">
                Track: <span className="font-semibold text-white">{lastSessionInfo.track.title}</span>
                {' · '}Trang {lastSessionInfo.pdfPage}
                {lastSessionInfo.pdfKind === 'kaitou' ? ' (Đáp án/Script)' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenBook(
                  lastSessionInfo.book,
                  lastSessionInfo.track.id,
                  lastSessionInfo.pdfPage,
                  lastSessionInfo.pdfKind
                )
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigoKaiwa shadow transition hover:bg-indigo-50"
            >
              <Play className="h-4 w-4 fill-current" />
              Tiếp tục Shadowing ngay
            </button>
          </div>
        </section>
      )}

      {/* Quick Plan & Review Strip */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigoKaiwa dark:bg-indigo-950/70 dark:text-indigo-300">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold">Lộ trình học hôm nay</p>
              {todayPlanDay ? (
                <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                  {todayPlanDay.title} · {todayPlanDay.completedTrackIds.length}/
                  {todayPlanDay.newTrackIds.length + todayPlanDay.reviewTrackIds.length} bài{' '}
                  {isPlanDayComplete(todayPlanDay) ? '✓' : ''}
                </p>
              ) : (
                <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                  Chưa có lộ trình — lập kế hoạch Đời sống hoặc Công việc
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('plan')}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigoKaiwa hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
          >
            <span>{todayPlanDay ? 'Xem bài hôm nay' : 'Lập kế hoạch'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                dueReviewCount > 0
                  ? 'bg-red-50 text-vermilion dark:bg-red-950/60 dark:text-red-300'
                  : 'bg-emerald-50 text-matcha dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold">Ôn tập ngắt quãng (SRS)</p>
              <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                {dueReviewCount > 0
                  ? `${dueReviewCount} bài đến hạn ôn lại hôm nay`
                  : 'Không có bài quá hạn · xem biểu đồ & kho Kaiwa'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('progress')}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              dueReviewCount > 0
                ? 'bg-vermilion text-white hover:bg-red-700'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <span>{dueReviewCount > 0 ? 'Ôn tập ngay' : 'Xem tiến độ'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Daily Stats Strip */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
              Mục tiêu hôm nay
            </span>
            <Clock className="h-4 w-4 text-indigoKaiwa" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold">{todayMinutes}</span>
            <span className="text-xs text-stone-500 dark:text-slate-400">/ {goalMinutes} phút</span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigoKaiwa transition-all"
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
              Chuỗi ngày luyện tập
            </span>
            <Flame className="h-4 w-4 text-vermilion" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold">{streak}</span>
            <span className="text-xs text-stone-500 dark:text-slate-400">ngày liên tiếp</span>
          </div>
          <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
            Duy trì 15–20 phút/ngày để tạo phản xạ miệng tự nhiên
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
              Tiến độ toàn kho sách
            </span>
            <CheckCircle2 className="h-4 w-4 text-matcha" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{masteredCount}</span>
            <span className="text-xs text-stone-500 dark:text-slate-400">
              thành thạo · {practicedCount}/{totalTracks} track đã chạm
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-matcha transition-all"
              style={{
                width: `${totalTracks > 0 ? Math.round((masteredCount / totalTracks) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* Category Filter Tabs */}
      {books.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => {
              const active = activeCategory === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-indigoKaiwa text-white shadow-sm'
                      : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
            <FolderOpen
              className={`h-3.5 w-3.5 ${
                mediaMode === 'local-folder' ? 'text-matcha' : ''
              }`}
            />
            <span className="max-w-xs truncate" title={mediaRoot}>
              {mediaMode === 'local-folder'
                ? `Đang đọc trực tiếp trên máy: ${mediaRoot}`
                : mediaRoot}
            </span>
            {mediaMode === 'local-folder' && (
              <button
                type="button"
                onClick={() => {
                  if (pickerSupported) onPickLocalFolder()
                  else fileInputRef.current?.click()
                }}
                className="font-semibold text-indigoKaiwa hover:underline dark:text-indigo-300"
              >
                Đổi thư mục
              </button>
            )}
          </div>
        </section>
      )}

      {/* Book Grid */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredBooks.map((book) => {
          const allTracks = book.sections.flatMap((s) => s.tracks)
          const bookMastered = allTracks.filter(
            (t) => state.trackProgress[t.id]?.status === 'mastered'
          ).length
          const bookLearning = allTracks.filter(
            (t) => state.trackProgress[t.id]?.status === 'learning'
          ).length
          const pct =
            allTracks.length > 0 ? Math.round((bookMastered / allTracks.length) * 100) : 0

          return (
            <article
              key={book.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className="relative flex h-36 items-end p-4 text-white"
                style={{
                  background: `linear-gradient(135deg, ${book.accentColor}, #1e293b)`,
                }}
              >
                {book.coverUrl && (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="absolute right-3 top-3 h-28 w-20 rounded-md object-cover shadow-lg ring-2 ring-white/30"
                  />
                )}
                <div className={`space-y-1 ${book.coverUrl ? 'pr-24' : ''}`}>
                  <span className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                    {book.level}
                  </span>
                  <h3 className="font-jp line-clamp-2 text-base font-bold leading-snug">
                    {book.title}
                  </h3>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                    {book.subtitle}
                  </p>
                  <p className="text-xs leading-relaxed text-stone-600 dark:text-slate-300">
                    {book.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {book.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                    {book.kaitouPdfUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <FileText className="h-3 w-3" />
                        Kèm Đáp án/Script
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-stone-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Headphones className="h-3.5 w-3.5" />
                      {book.totalTracks} file nghe
                    </span>
                    <span>
                      {bookMastered} xong · {bookLearning} đang học ({pct}%)
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-matcha transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenBook(book)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigoKaiwa px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <BookOpen className="h-4 w-4" />
                    Luyện Shadowing
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
