import { useEffect } from 'react'

export function useSessionEvents(sessionId, onEvent) {
  useEffect(() => {
    if (!sessionId) return
    const token = localStorage.getItem('token')
    const url = `/api/sessions/${sessionId}/events?token=${token}`
    const es = new EventSource(url)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type !== 'connected') onEvent(data)
      } catch (_) {}
    }
    es.onerror = () => {} // suppress console errors on close
    return () => es.close()
  }, [sessionId])
}
