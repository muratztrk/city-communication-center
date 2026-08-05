import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      render: (container: HTMLElement, parameters: { sitekey: string; theme?: 'light' | 'dark' }) => number
      getResponse: (widgetId?: number) => string
      reset: (widgetId?: number) => void
    }
  }
}

export interface RecaptchaWidgetHandle {
  getToken: () => string
  reset: () => void
}

interface RecaptchaWidgetProps {
  siteKey: string
  theme?: 'light' | 'dark'
}

let scriptLoadPromise: Promise<void> | null = null

function loadRecaptchaScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.grecaptcha) {
    return Promise.resolve()
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ccc-recaptcha="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA script failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.cccRecaptcha = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('reCAPTCHA script failed to load'))
    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

export const RecaptchaWidget = forwardRef<RecaptchaWidgetHandle, RecaptchaWidgetProps>(function RecaptchaWidget(
  { siteKey, theme = 'light' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    getToken: () => {
      if (widgetIdRef.current === null || !window.grecaptcha) {
        return ''
      }

      return window.grecaptcha.getResponse(widgetIdRef.current) || ''
    },
    reset: () => {
      if (widgetIdRef.current === null || !window.grecaptcha) {
        return
      }

      window.grecaptcha.reset(widgetIdRef.current)
    },
  }))

  useEffect(() => {
    let isActive = true
    const container = containerRef.current

    const renderWidget = async () => {
      await loadRecaptchaScript()
      if (!isActive || !containerRef.current || !window.grecaptcha) {
        return
      }

      window.grecaptcha.ready(() => {
        if (!isActive || !containerRef.current || widgetIdRef.current !== null) {
          return
        }

        widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
          sitekey: siteKey,
          theme,
        })
      })
    }

    void renderWidget()

    return () => {
      isActive = false
      widgetIdRef.current = null
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [siteKey, theme])

  return <div ref={containerRef} className="flex justify-center" />
})
