import { Globe, Mail, Phone } from 'lucide-react'

interface ChannelIconProps {
  channel: string
  className?: string
}

export function ChannelIcon({ channel, className = 'size-4' }: ChannelIconProps) {
  switch (channel) {
    case 'WhatsApp':
      return <img src="/icons/whatsapp.webp" className={className} alt="WhatsApp" />
    case 'Instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Instagram">
          <defs>
            <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#f09433" />
              <stop offset="25%" stopColor="#e6683c" />
              <stop offset="50%" stopColor="#dc2743" />
              <stop offset="75%" stopColor="#cc2366" />
              <stop offset="100%" stopColor="#bc1888" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig-grad)" strokeWidth="1.8" fill="none" />
          <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="1.8" />
          <circle cx="17" cy="7" r="1.2" fill="#dc2743" />
        </svg>
      )
    case 'Facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Facebook">
          <path
            d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
            stroke="#1877F2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )
    case 'X':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="X">
          <path
            d="M13.95 10.6 18.9 5h-1.2L13.4 9.8 10 5H6l5.2 7.5L6 18.5h1.2l4.6-5.1 3.7 5.1H19.5L13.95 10.6Zm-1.55 2.1-.6-.8-4.2-6.1h1.8l3.5 4.7.6.8 4.2 6.4h-1.8l-3.5-5Z"
            fill="#0f172a"
          />
        </svg>
      )
    case 'Phone':
      return <Phone className={className} style={{ color: '#0ea5e9' }} aria-label="Çağrı" />
    case 'Email':
      return <Mail className={className} style={{ color: '#6366f1' }} aria-label="E-posta" />
    case 'WebForm':
      return <Globe className={className} style={{ color: '#10b981' }} aria-label="Web Formu" />
    case 'EDevlet':
      return <img src="/icons/e-devlet.png" className={className} alt="e-Devlet" />
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label={channel}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}
