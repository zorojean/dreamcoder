import { create } from 'zustand'
import { isThemeMode, THEME_MODES, type ThemeMode } from '../types/settings'

const THEME_STORAGE_KEY = 'dreamcoder-theme'
const SIDEBAR_WIDTH_STORAGE_KEY = 'dreamcoder-sidebar-width'
const SYSTEM_DARK_THEME_QUERY = '(prefers-color-scheme: dark)'

export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_MAX_WIDTH = 400
export const SIDEBAR_DEFAULT_WIDTH = 280

type ResolvedThemeMode = Exclude<ThemeMode, 'system'>
const DARK_COLOR_SCHEME_THEMES = new Set<ResolvedThemeMode>(['dark', 'midnight'])
let stopSystemThemeListener: (() => void) | null = null

function getStoredSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (stored) {
      const val = Number(stored)
      if (Number.isFinite(val)) return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, val))
    }
  } catch { /* localStorage unavailable */ }
  return SIDEBAR_DEFAULT_WIDTH
}

function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeMode(stored)) return stored
  } catch { /* localStorage unavailable */ }
  return 'white'
}

function resolveSystemTheme(): ResolvedThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'white'
  return window.matchMedia(SYSTEM_DARK_THEME_QUERY).matches ? 'dark' : 'white'
}

export function resolveTheme(theme: ThemeMode): ResolvedThemeMode {
  return theme === 'system' ? resolveSystemTheme() : theme
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  const resolvedTheme = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', resolvedTheme)
  document.documentElement.setAttribute('data-theme-preference', theme)
  document.documentElement.style.colorScheme = DARK_COLOR_SCHEME_THEMES.has(resolvedTheme) ? 'dark' : 'light'
}

function handleSystemThemeChange() {
  if (useUIStore.getState().theme === 'system') {
    applyTheme('system')
  }
}

function startSystemThemeListener() {
  if (stopSystemThemeListener || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

  const mediaQuery = window.matchMedia(SYSTEM_DARK_THEME_QUERY)
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    stopSystemThemeListener = () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
    return
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleSystemThemeChange)
    stopSystemThemeListener = () => mediaQuery.removeListener(handleSystemThemeChange)
  }
}

function syncSystemThemeListener(theme: ThemeMode) {
  if (theme === 'system') {
    startSystemThemeListener()
    return
  }

  stopSystemThemeListener?.()
  stopSystemThemeListener = null
}

export function initializeTheme() {
  const theme = getStoredTheme()
  applyTheme(theme)
  syncSystemThemeListener(theme)
}

export type Toast = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export type SettingsTab =
  | 'providers'
  | 'permissions'
  | 'activity'
  | 'general'
  | 'h5Access'
  | 'adapters'
  | 'terminal'
  | 'mcp'
  | 'agents'
  | 'skills'
  | 'memory'
  | 'plugins'
  | 'computerUse'
  | 'diagnostics'
  | 'about'

type ActiveView = 'code' | 'scheduled' | 'terminal' | 'history' | 'settings'

type UIStore = {
  theme: ThemeMode
  sidebarOpen: boolean
  sidebarWidth: number
  activeView: ActiveView
  pendingSettingsTab: SettingsTab | null
  pendingMemoryPath: string | null
  activeModal: string | null
  toasts: Toast[]

  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  setActiveView: (view: ActiveView) => void
  setPendingSettingsTab: (tab: SettingsTab | null) => void
  setPendingMemoryPath: (path: string | null) => void
  openModal: (id: string) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useUIStore = create<UIStore>((set) => ({
  theme: getStoredTheme(),
  sidebarOpen: true,
  sidebarWidth: getStoredSidebarWidth(),
  activeView: 'code',
  pendingSettingsTab: null,
  pendingMemoryPath: null,
  activeModal: null,
  toasts: [],

  setTheme: (theme) => {
    applyTheme(theme)
    syncSystemThemeListener(theme)
    try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* noop */ }
    set({ theme })
  },

  toggleTheme: () => {
    set((state) => {
      const currentIndex = THEME_MODES.indexOf(state.theme)
      const next = THEME_MODES[(currentIndex + 1) % THEME_MODES.length] ?? 'white'
      applyTheme(next)
      syncSystemThemeListener(next)
      try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* noop */ }
      return { theme: next }
    })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarWidth: (width) => {
    const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))
    try { localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped)) } catch { /* noop */ }
    set({ sidebarWidth: clamped })
  },
  setActiveView: (view) => set({ activeView: view }),
  setPendingSettingsTab: (tab) => set({ pendingSettingsTab: tab }),
  setPendingMemoryPath: (path) => set({ pendingMemoryPath: path }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    // Auto-remove after duration
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
