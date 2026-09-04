let audioContext: AudioContext | null = null
let lastPlayedAt = 0

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioContextCtor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null
    audioContext ??= new AudioContextCtor()
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    return audioContext
  } catch {
    return null
  }
}

/** Sol menü sayfalarında yeni kayıt geldiğinde kısa bildirim sesi (#3390). */
export function playNewRecordSound(): void {
  const nowMs = Date.now()
  if (nowMs - lastPlayedAt < 800) return
  lastPlayedAt = nowMs

  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, now)
  oscillator.frequency.setValueAtTime(660, now + 0.08)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.3)
}
