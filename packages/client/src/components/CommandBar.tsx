import { useRef, useEffect, useState, useCallback } from 'react'
import { useServerStore } from '../store/useServerStore'

interface CommandBarProps {
  onExplorePath: (path: string) => void
}

export function CommandBar({ onExplorePath }: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')

  const {
    commandBarVisible,
    setCommandBarVisible,
    explorerPath,
    explorerBreadcrumbs,
    explorerLoading,
    explorerError,
    clearExplorer,
    popBreadcrumb,
  } = useServerStore()

  // Focus when shown
  useEffect(() => {
    if (commandBarVisible) {
      setInputValue(explorerPath ?? '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandBarVisible, explorerPath])

  // Flash red on error
  const [errorFlash, setErrorFlash] = useState(false)
  useEffect(() => {
    if (explorerError) {
      setErrorFlash(true)
      const t = setTimeout(() => setErrorFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [explorerError])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const path = inputValue.trim()
        if (path) onExplorePath(path)
      } else if (e.key === 'Escape') {
        clearExplorer()
        setCommandBarVisible(false)
        setInputValue('')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (explorerBreadcrumbs.length > 1) {
          popBreadcrumb()
          const parent = explorerBreadcrumbs[explorerBreadcrumbs.length - 2]
          setInputValue(parent)
          onExplorePath(parent)
        } else {
          // Navigate to parent dir of current input
          const parent = inputValue.split('/').slice(0, -1).join('/') || '/'
          setInputValue(parent)
        }
      }
    },
    [inputValue, onExplorePath, clearExplorer, setCommandBarVisible, explorerBreadcrumbs, popBreadcrumb],
  )

  if (!commandBarVisible) return null

  const borderColor = errorFlash ? '#ef4444' : explorerLoading ? '#f59e0b' : '#00ff41'
  const errorLabel = explorerError === 'not_found'
    ? 'path not found'
    : explorerError === 'permission_denied'
    ? 'permission denied'
    : explorerError === 'is_file'
    ? 'not a directory'
    : null

  return (
    <div
      className="absolute top-4 left-1/2 z-50"
      style={{ transform: 'translateX(-50%)', width: '520px' }}
    >
      {/* Breadcrumb trail */}
      {explorerBreadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 mb-1 px-1" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
          {explorerBreadcrumbs.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1">
              {i > 0 && <span style={{ color: '#4b5563' }}>/</span>}
              <button
                onClick={() => {
                  setInputValue(crumb)
                  onExplorePath(crumb)
                }}
                style={{
                  color: i === explorerBreadcrumbs.length - 1 ? '#00ff41' : '#6b7280',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                {crumb === '/' ? '/' : crumb.split('/').pop()}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Command input */}
      <div
        style={{
          background: 'rgba(0,0,0,0.92)',
          border: `1px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: `0 0 12px ${borderColor}40`,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ color: '#00ff41', fontFamily: 'monospace', fontSize: '14px' }}>›</span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type path and press Enter…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: errorFlash ? '#ef4444' : '#00ff41',
            fontFamily: 'monospace',
            fontSize: '14px',
            caretColor: '#00ff41',
          }}
        />
        {explorerLoading && (
          <span style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '12px' }}>loading…</span>
        )}
        {errorLabel && !explorerLoading && (
          <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '11px' }}>{errorLabel}</span>
        )}
        <span
          style={{ color: '#374151', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          ↑ parent · Esc close
        </span>
      </div>
    </div>
  )
}
