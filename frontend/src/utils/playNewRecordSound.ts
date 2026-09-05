import { isNewRecordSoundSuppressed } from './newRecordSoundSuppress'

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

const MELODY_NOTES = [
  { freq: 523.25, start: 0, duration: 0.38 },
  { freq: 659.25, start: 0.42, duration: 0.38 },
  { freq: 783.99, start: 0.84, duration: 0.48 },
  { freq: 987.77, start: 1.38, duration: 0.55 },
] as const

/** Sol menü sayfalarında yeni kayıt geldiğinde ~2 sn bildirim melodisi (#3390 reopen). */
export function playNewRecordSound(): void {
  if (isNewRecordSoundSuppressed()) return
  const nowMs = Date.now()
  if (nowMs - lastPlayedAt < 2_200) return
  lastPlayedAt = nowMs

  const ctx = getAudioContext()
  if (!ctx) return

  const base = ctx.currentTime
  for (const note of MELODY_NOTES) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'triangle'
    const start = base + note.start
    oscillator.frequency.setValueAtTime(note.freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.11, start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + note.duration + 0.04)
  }
}
