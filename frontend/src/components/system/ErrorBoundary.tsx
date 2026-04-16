import { Component, type ErrorInfo, type PropsWithChildren } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
          <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-foreground)]">
              Bir şeyler ters gitti
            </h2>
            <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
              Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Tekrar Dene
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-hover)]"
              >
                Sayfayı Yenile
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
