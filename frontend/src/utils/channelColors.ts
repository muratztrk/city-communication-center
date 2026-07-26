/** Kanal adı metin rengi — ChannelIcon rengi ile aynı (card #1532 / #r486). */
export function getChannelLabelColor(channel: string): string {
  switch (channel) {
    case 'WhatsApp':
      // Marka yeşili biraz koyu — Talep Bilgileri başlık etiketi (#r486).
      return '#1EBE57'
    case 'Phone':
      return '#0ea5e9'
    case 'Email':
      return '#6366f1'
    case 'WebForm':
      return '#10b981'
    case 'Facebook':
      return '#1877F2'
    case 'Instagram':
      return '#dc2743'
    case 'X':
      return '#0f172a'
    default:
      return '#64748b'
  }
}
