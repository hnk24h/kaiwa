import React from 'react'
import { HomeTab } from '../types'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Headphones,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'

interface TopNavHeaderProps {
  activeTab: HomeTab
  onChangeTab: (tab: HomeTab) => void
  dueReviewCount: number
  darkMode: boolean
  onToggleDarkMode: () => void
  onOpenSettings: () => void
}

export const TopNavHeader: React.FC<TopNavHeaderProps> = ({
  activeTab,
  onChangeTab,
  dueReviewCount,
  darkMode,
  onToggleDarkMode,
  onOpenSettings,
}) => {
  const tabs: Array<{
    id: HomeTab
    label: string
    icon: React.ReactNode
    badge?: number
  }> = [
    { id: 'library', label: 'Thư viện sách', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'plan', label: 'Lộ trình học', icon: <CalendarDays className="h-4 w-4" /> },
    {
      id: 'progress',
      label: 'Tiến độ & Ôn tập',
      icon: <BarChart3 className="h-4 w-4" />,
      badge: dueReviewCount > 0 ? dueReviewCount : undefined,
    },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigoKaiwa text-white shadow-sm">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight sm:text-lg">
              Kaiwa Shadowing Studio
            </h1>
            <p className="text-[11px] text-stone-500 dark:text-slate-400">
              Tự học nói tiếng Nhật phản xạ từ sách PDF & Audio gốc
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="order-3 flex w-full items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 md:order-2 md:w-auto dark:border-slate-700 dark:bg-slate-800">
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition md:flex-initial ${
                  active
                    ? 'bg-white text-indigoKaiwa shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-stone-600 hover:text-ink dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-0.5 rounded-full bg-vermilion px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="order-2 flex items-center gap-2 md:order-3">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Chuyển chế độ Sáng / Tối"
          >
            {darkMode ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{darkMode ? 'Sáng' : 'Tối'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Settings className="h-4 w-4" />
            <span>Cài đặt</span>
          </button>
        </div>
      </div>
    </header>
  )
}
