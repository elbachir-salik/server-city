import { useEffect } from 'react'
import { useServerStore } from '../store/useServerStore'

export function useKeyboardShortcuts() {
  const store = useServerStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't fire when user is typing in a form field
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'r':
        case 'R':
          store.resetCamera()
          break
        case 'Escape':
          if (store.commandBarVisible) {
            store.clearExplorer()
            store.setCommandBarVisible(false)
          } else {
            store.setSelectedFloor(null)
          }
          break
        case 'f':
        case 'F':
          if (store.status === 'connected') store.setCommandBarVisible(!store.commandBarVisible)
          break
        case 'd':
        case 'D':
          store.toggleDiskSidebar()
          break
        case 'p':
        case 'P':
          store.toggleProcessPanel()
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          const floor = Number(e.key) - 1
          store.setSelectedFloor(store.selectedFloor === floor ? null : floor)
          break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])
}
