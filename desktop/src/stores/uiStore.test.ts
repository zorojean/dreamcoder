import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalMatchMedia = window.matchMedia

function installColorSchemeMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQuery = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.add(listener)
    }),
    removeEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.delete(listener)
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  const matchMedia = vi.fn(() => mediaQuery)
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia

  return {
    matchMedia,
    mediaQuery,
    setMatches(nextMatches: boolean) {
      matches = nextMatches
      const event = { matches, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

describe('uiStore theme handling', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme-preference')
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia
    } else {
      Reflect.deleteProperty(window, 'matchMedia')
    }
  })

  it('defaults new installs to the pure white theme', async () => {
    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('white')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.getAttribute('data-theme-preference')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('hydrates and applies the pure white theme as a light color scheme', async () => {
    window.localStorage.setItem('dreamcoder-theme', 'white')

    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('white')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.getAttribute('data-theme-preference')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('resolves the system theme and follows system appearance changes', async () => {
    const controller = installColorSchemeMatchMedia(true)
    window.localStorage.setItem('dreamcoder-theme', 'system')

    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('system')
    initializeTheme()
    expect(controller.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme-preference')).toBe('system')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    controller.setMatches(false)

    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.getAttribute('data-theme-preference')).toBe('system')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('cycles through configured theme modes', async () => {
    const { useUIStore } = await import('./uiStore')

    for (const expected of ['light', 'dark', 'dreamfield', 'amber', 'midnight', 'system', 'white']) {
      useUIStore.getState().toggleTheme()
      expect(useUIStore.getState().theme).toBe(expected)
      expect(document.documentElement.getAttribute('data-theme-preference')).toBe(expected)
    }

    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
