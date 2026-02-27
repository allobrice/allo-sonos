import { ref, onMounted, onUnmounted } from 'vue'

export function useWebSocket(onMessage?: (event: string, data: unknown) => void) {
  const connected = ref(false)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${proto}//${location.host}/ws`)

    ws.onopen = () => {
      connected.value = true
      reconnectDelay = 1000 // reset on successful connect
    }

    ws.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data)
        onMessage?.(event, data)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      connected.value = false
      scheduleReconnect()
    }

    ws.onerror = () => {
      connected.value = false
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectDelay = Math.min(reconnectDelay * 2, 8000)
      connect()
    }, reconnectDelay)
  }

  onMounted(() => connect())

  onUnmounted(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  })

  return { connected }
}
