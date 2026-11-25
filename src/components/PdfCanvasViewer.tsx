import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { PdfMaskMode } from '../types'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Languages,
  Loader2,
  Maximize2,
  Pin,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfCanvasViewerProps {
  mainPdfUrl: string | null
  kaitouPdfUrl: string | null
  pdfKind: 'main' | 'kaitou'
  onChangePdfKind: (kind: 'main' | 'kaitou') => void
  page: number
  onChangePage: (page: number) => void
  mappedPage?: number
  pinnedPage?: number
  hasTranslationFacingPage?: boolean
  autoPin: boolean
  onPinCurrentPage: () => void
  onResetPinnedPage?: () => void
  maskMode: PdfMaskMode
  onChangeMaskMode: (mode: PdfMaskMode) => void
  isPeeking: boolean
}

type ZoomMode = 'fit-width' | 'fit-page' | 'custom'

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  mainPdfUrl,
  kaitouPdfUrl,
  pdfKind,
  onChangePdfKind,
  page,
  onChangePage,
  mappedPage,
  pinnedPage,
  hasTranslationFacingPage,
  autoPin,
  onPinCurrentPage,
  onResetPinnedPage,
  maskMode,
  onChangeMaskMode,
  isPeeking,
}) => {
  const activeUrl = pdfKind === 'kaitou' && kaitouPdfUrl ? kaitouPdfUrl : mainPdfUrl

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)

  const [numPages, setNumPages] = useState<number>(0)
  const [loadingDoc, setLoadingDoc] = useState<boolean>(false)
  const [renderingPage, setRenderingPage] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width')
  const [customScale, setCustomScale] = useState<number>(1.25)
  const [rotation, setRotation] = useState<number>(0)
  const [pageInput, setPageInput] = useState<string>(String(page))
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const [containerHeight, setContainerHeight] = useState<number>(600)
  const [curtainPercent, setCurtainPercent] = useState<number>(52)
  const draggingCurtainRef = useRef<boolean>(false)

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(320, entry.contentRect.width - 32))
        setContainerHeight(Math.max(300, entry.contentRect.height - 32))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!activeUrl) {
      pdfDocRef.current = null
      setNumPages(0)
      return
    }

    let cancelled = false
    setLoadingDoc(true)
    setErrorMsg(null)

    const loadingTask = pdfjsLib.getDocument({
      url: activeUrl,
      disableAutoFetch: true,
      disableStream: false,
      rangeChunkSize: 65536,
    })

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy()
          return
        }
        if (pdfDocRef.current && pdfDocRef.current !== doc) {
          pdfDocRef.current.destroy().catch(() => {})
        }
        pdfDocRef.current = doc
        setNumPages(doc.numPages)
        if (page > doc.numPages) {
          onChangePage(1)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : 'Không thể mở file PDF')
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false)
      })

    return () => {
      cancelled = true
      loadingTask.destroy().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl])

  const renderCurrentPage = useCallback(async () => {
    const doc = pdfDocRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || numPages === 0) return

    const targetPage = Math.max(1, Math.min(page, numPages))

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        // ignore
      }
      renderTaskRef.current = null
    }

    setRenderingPage(true)
    try {
      const pdfPage = await doc.getPage(targetPage)
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation })

      let scale = customScale
      if (zoomMode === 'fit-width') {
        scale = containerWidth / baseViewport.width
      } else if (zoomMode === 'fit-page') {
        scale = Math.min(
          containerWidth / baseViewport.width,
          containerHeight / baseViewport.height
        )
      }
      scale = Math.max(0.4, Math.min(3.5, scale))

      const viewport = pdfPage.getViewport({ scale, rotation })
      const outputScale = window.devicePixelRatio || 1

      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0)

      const task = pdfPage.render({
        canvasContext: ctx,
        viewport,
      })
      renderTaskRef.current = task
      await task.promise
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name
      if (name !== 'RenderingCancelledException') {
        setErrorMsg(err instanceof Error ? err.message : 'Lỗi hiển thị trang PDF')
      }
    } finally {
      setRenderingPage(false)
    }
  }, [page, numPages, zoomMode, customScale, rotation, containerWidth, containerHeight])

  useEffect(() => {
    renderCurrentPage()
  }, [renderCurrentPage])

  function handlePageInputSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(pageInput)
    if (!Number.isNaN(parsed) && numPages > 0) {
      onChangePage(Math.max(1, Math.min(parsed, numPages)))
    } else {
      setPageInput(String(page))
    }
  }

  function handleCurtainPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingCurtainRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = ((e.clientY - rect.top) / rect.height) * 100
    setCurtainPercent(Math.max(10, Math.min(90, pct)))
  }

  const effectiveBlur = maskMode === 'blur' && !isPeeking
  const effectiveCurtain = maskMode === 'curtain' && !isPeeking
  const isOnTranslationPage =
    Boolean(hasTranslationFacingPage && pdfKind === 'main' && mappedPage && page === mappedPage + 1)

  return (
    <div className="flex h-full min-h-0 flex-col bg-stone-100/80 dark:bg-slate-950">
      {/* PDF Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Left: Main / Kaitou switcher + Page nav + Sync helpers */}
        <div className="flex flex-wrap items-center gap-2">
          {kaitouPdfUrl && (
            <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => onChangePdfKind('main')}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  pdfKind === 'main'
                    ? 'bg-white text-indigoKaiwa shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-stone-600 dark:text-slate-300'
                }`}
              >
                Sách chính
              </button>
              <button
                type="button"
                onClick={() => onChangePdfKind('kaitou')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                  pdfKind === 'kaitou'
                    ? 'bg-white text-matcha shadow-sm dark:bg-slate-700 dark:text-emerald-300'
                    : 'text-stone-600 dark:text-slate-300'
                }`}
              >
                <FileText className="h-3 w-3" />
                Đáp án / Script
              </button>
            </div>
          )}

          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onChangePage(Math.max(1, page - 1))}
              className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              title="Trang trước (phím ,)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputSubmit}
                className="w-12 rounded-lg border border-stone-200 bg-white px-2 py-1 text-center font-semibold dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-stone-500 dark:text-slate-400">/ {numPages || '—'}</span>
            </form>
            <button
              type="button"
              disabled={numPages > 0 && page >= numPages}
              onClick={() => onChangePage(numPages > 0 ? Math.min(numPages, page + 1) : page + 1)}
              className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              title="Trang sau (phím .)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Facing Vietnamese translation toggle for Kuroshio Shadowing books */}
          {hasTranslationFacingPage && pdfKind === 'main' && mappedPage && (
            <button
              type="button"
              onClick={() => onChangePage(isOnTranslationPage ? mappedPage : mappedPage + 1)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition ${
                isOnTranslationPage
                  ? 'border-emerald-300 bg-emerald-50 text-matcha dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
              title="Chuyển nhanh giữa trang hội thoại tiếng Nhật và trang dịch tiếng Việt kế bên"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>
                {isOnTranslationPage ? `Về tiếng Nhật (Tr.${mappedPage})` : `Dịch Việt (Tr.${mappedPage + 1})`}
              </span>
            </button>
          )}

          {/* Back to mapped page pill if user scrolled elsewhere */}
          {mappedPage && page !== mappedPage && !isOnTranslationPage && (
            <button
              type="button"
              onClick={() => onChangePage(mappedPage)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              title="Quay lại đúng trang của bài nghe hiện tại"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Về bài nghe (Tr.{mappedPage})</span>
            </button>
          )}

          {/* Pin Page + Reset */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onPinCurrentPage}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition ${
                pinnedPage === page
                  ? 'border-indigo-200 bg-indigo-50 text-indigoKaiwa dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              title={
                autoPin
                  ? 'Đang bật tự động ghim trang khi lật PDF'
                  : 'Ghim cố định trang này cho track hiện tại'
              }
            >
              <Pin className="h-3.5 w-3.5" />
              <span>{pinnedPage === page ? `Đã ghim Tr.${page}` : `Ghim Tr.${page}`}</span>
            </button>
            {pinnedPage !== undefined && onResetPinnedPage && (
              <button
                type="button"
                onClick={onResetPinnedPage}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-slate-800"
                title="Bỏ ghim thủ công (dùng lại trang mặc định của sách)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Zoom + Rotate + Blind Mask */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => onChangeMaskMode('clear')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${
                maskMode === 'clear'
                  ? 'bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-stone-500 dark:text-slate-400'
              }`}
              title="Hiện rõ trang sách (H)"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Hiện rõ</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMaskMode('blur')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${
                maskMode === 'blur'
                  ? 'bg-vermilion text-white shadow-sm'
                  : 'text-stone-500 dark:text-slate-400'
              }`}
              title="Làm mờ để Shadowing mù — giữ phím V để liếc nhanh (H)"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Làm mờ (H)</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMaskMode('curtain')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${
                maskMode === 'curtain'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-stone-500 dark:text-slate-400'
              }`}
              title="Rèm che kéo thả (che nửa dưới / phần dịch)"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Rèm che</span>
            </button>
          </div>

          <div className="h-4 w-px bg-stone-200 dark:bg-slate-700" />

          <button
            type="button"
            onClick={() => setZoomMode('fit-width')}
            className={`rounded-lg border px-2 py-1 font-medium ${
              zoomMode === 'fit-width'
                ? 'border-indigoKaiwa bg-indigo-50 text-indigoKaiwa dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-stone-200 text-stone-600 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            Vừa ngang
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('fit-page')}
            className={`hidden rounded-lg border px-2 py-1 font-medium sm:inline-flex ${
              zoomMode === 'fit-page'
                ? 'border-indigoKaiwa bg-indigo-50 text-indigoKaiwa dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-stone-200 text-stone-600 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Vừa cả trang"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomMode('custom')
              setCustomScale((s) => Math.max(0.5, Number((s - 0.15).toFixed(2))))
            }}
            className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800"
            title="Thu nhỏ (-)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomMode('custom')
              setCustomScale((s) => Math.min(3, Number((s + 0.15).toFixed(2))))
            }}
            className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800"
            title="Phóng to (+)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800"
            title="Xoay 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto p-4"
        onPointerMove={handleCurtainPointerMove}
        onPointerUp={() => {
          draggingCurtainRef.current = false
        }}
        onPointerLeave={() => {
          draggingCurtainRef.current = false
        }}
      >
        {!activeUrl ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-stone-500">
            Không có file PDF cho sách này.
          </div>
        ) : errorMsg ? (
          <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            <p className="font-semibold">Không tải được PDF</p>
            <p className="mt-1">{errorMsg}</p>
          </div>
        ) : (
          <div className="relative mx-auto flex w-fit justify-center">
            {(loadingDoc || renderingPage) && (
              <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{loadingDoc ? 'Đang mở sách...' : 'Đang vẽ trang...'}</span>
              </div>
            )}

            <div className="relative overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-stone-200 dark:ring-slate-700">
              <canvas
                ref={canvasRef}
                className={`block transition duration-200 ${
                  effectiveBlur ? 'select-none blur-md brightness-95' : ''
                }`}
              />

              {effectiveBlur && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-900/15">
                  <div className="rounded-2xl bg-slate-900/85 px-5 py-3 text-center text-white shadow-xl backdrop-blur">
                    <p className="text-sm font-bold">Chế độ Nghe chay / Shadowing mù</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Giữ phím <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono">V</kbd> để liếc nhanh · Nhấn <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono">H</kbd> để hiện lại
                    </p>
                  </div>
                </div>
              )}

              {effectiveCurtain && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-slate-900/90 backdrop-blur-sm transition-[top] duration-75"
                  style={{ top: `${curtainPercent}%` }}
                >
                  <div
                    onPointerDown={(e) => {
                      e.preventDefault()
                      draggingCurtainRef.current = true
                    }}
                    className="flex h-7 cursor-ns-resize items-center justify-center border-b border-amber-400/50 bg-amber-500/90 text-[11px] font-semibold text-white shadow"
                  >
                    ⋮⋮ Kéo lên / xuống để che phần dịch hoặc script (giữ V để liếc) ⋮⋮
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
