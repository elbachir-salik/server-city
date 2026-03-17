import { useEffect, useState } from 'react'
import { useServerStore } from '../store/useServerStore'

interface Alert {
  id: string
  message: string
  timestamp: number
}

function Toast({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const time = new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      style={{
        background: 'rgba(8,8,20,0.96)',
        border: '1px solid #ef444466',
        borderLeft: '3px solid #ef4444',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        maxWidth: 320,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(239,68,68,0.15)',
        animation: 'slideIn 0.25s ease',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5 }}>
          {alert.message}
        </div>
        <div style={{ color: '#6b7280', fontSize: 10, marginTop: 3 }}>{time}</div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
          fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}

export function AlertToast() {
  const alerts = useServerStore(s => s.alertLog)
  const removeAlert = useServerStore(s => s.removeAlert)

  // Only show the last 3 alerts
  const visible = alerts.slice(-3)

  if (visible.length === 0) return null

  return (
    <>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }`}</style>
      <div
        style={{
          position: 'absolute',
          top: 64,
          right: 16,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {visible.map(a => (
          <Toast key={a.id} alert={a} onDismiss={() => removeAlert(a.id)} />
        ))}
      </div>
    </>
  )
}
