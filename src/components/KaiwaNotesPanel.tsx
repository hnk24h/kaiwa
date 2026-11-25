import React, { useState } from 'react'
import { ABPreset, KaiwaNote } from '../types'
import { formatTime } from '../utils/time'
import { Play, Plus, Repeat, Trash2 } from 'lucide-react'

interface KaiwaNotesPanelProps {
  mode: 'notes' | 'ab'
  currentTime: number
  notes: KaiwaNote[]
  abPresets: ABPreset[]
  onAddNote: (note: Omit<KaiwaNote, 'id' | 'createdAt'>) => void
  onDeleteNote: (noteId: string) => void
  onSeekAndPlay: (sec: number) => void
  onLoopAroundNote: (sec: number) => void
  onApplyAbPreset: (preset: ABPreset) => void
  onDeleteAbPreset: (presetId: string) => void
}

export const KaiwaNotesPanel: React.FC<KaiwaNotesPanelProps> = ({
  mode,
  currentTime,
  notes,
  abPresets,
  onAddNote,
  onDeleteNote,
  onSeekAndPlay,
  onLoopAroundNote,
  onApplyAbPreset,
  onDeleteAbPreset,
}) => {
  const [jpText, setJpText] = useState('')
  const [meaning, setMeaning] = useState('')
  const [capturedTime, setCapturedTime] = useState<number | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jpText.trim() && !meaning.trim()) return
    onAddNote({
      timeSec: Math.max(0, Math.floor(capturedTime ?? currentTime)),
      jpText: jpText.trim() || '(Cụm câu cần nhớ)',
      meaning: meaning.trim(),
    })
    setJpText('')
    setMeaning('')
    setCapturedTime(null)
  }

  if (mode === 'ab') {
    return (
      <div className="flex h-full flex-col gap-3 p-3.5 text-xs">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="font-semibold text-ink dark:text-slate-100">
            Đoạn A–B khó đã lưu ({abPresets.length})
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
            Đặt điểm <strong>A</strong> và <strong>B</strong> trên thanh Audio bên dưới rồi bấm{' '}
            <strong>Lưu A–B</strong> để gom các câu nối âm khó luyện lại sau.
          </p>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {abPresets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-[11px] text-stone-400 dark:border-slate-700">
              Chưa có đoạn A–B nào được lưu cho track này.
            </div>
          ) : (
            abPresets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink dark:text-slate-100">
                    {preset.label}
                  </p>
                  <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                    {formatTime(preset.a)} → {formatTime(preset.b)} (
                    {Math.round(preset.b - preset.a)}s)
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onApplyAbPreset(preset)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-600"
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    <span>Lặp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAbPreset(preset.id)}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60"
                    title="Xóa đoạn A-B"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3.5 text-xs">
      <form
        onSubmit={handleSubmit}
        className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink dark:text-slate-100">
            Lưu câu Kaiwa hay
          </span>
          <button
            type="button"
            onClick={() => setCapturedTime(Math.floor(currentTime))}
            className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigoKaiwa hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300"
          >
            Lấy mốc {formatTime(capturedTime ?? currentTime)}
          </button>
        </div>

        <input
          type="text"
          value={jpText}
          onChange={(e) => {
            if (capturedTime === null) setCapturedTime(Math.floor(currentTime))
            setJpText(e.target.value)
          }}
          placeholder="Câu tiếng Nhật (vd: 恐れ入りますが...)"
          className="font-jp w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigoKaiwa focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />

        <textarea
          rows={2}
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="Nghĩa / Ngữ cảnh dùng (vd: Xin lỗi làm phiền khi hỏi sếp)"
          className="w-full resize-none rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigoKaiwa focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigoKaiwa px-3 py-2 font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Lưu cụm câu tại {formatTime(capturedTime ?? currentTime)}
        </button>
      </form>

      <div className="flex-1 space-y-2 overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Đã ghi chú ({notes.length})
        </p>

        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-[11px] text-stone-400 dark:border-slate-700">
            Gặp câu giao tiếp hay hoặc kính ngữ muốn thuộc lòng? Hãy lưu lại kèm mốc thời gian để nghe lại 1 chạm!
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSeekAndPlay(note.timeSec)}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-matcha hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                  title="Phát tại mốc thời gian này"
                >
                  <Play className="h-3 w-3 fill-current" />
                  {formatTime(note.timeSec)}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onLoopAroundNote(note.timeSec)}
                    className="rounded-md border border-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600 hover:bg-stone-50 dark:border-slate-600 dark:text-slate-300"
                    title="Lặp 4 giây quanh câu này"
                  >
                    Lặp 4s
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="font-jp mt-1.5 text-sm font-semibold text-ink dark:text-slate-100">
                {note.jpText}
              </p>
              {note.meaning && (
                <p className="mt-1 text-[11px] leading-relaxed text-stone-600 dark:text-slate-300">
                  {note.meaning}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
