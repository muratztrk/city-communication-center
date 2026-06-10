import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, MessageSquareMore, SquareKanban, X, ShieldCheck } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  getTenantLoginContext,
  startInteractiveAuthentication,
  verifyInteractiveAuthentication,
} from '../api/auth'
import { AppFooter } from '../components/layout/AppFooter'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import { useTenantTheme } from '../context/ThemeContext'
import type { StartInteractiveAuthenticationResult, TenantLoginContext } from '../types/platform'

type LoginStep = 'credentials' | 'secondFactor'

interface SecurityState {
  secondFactorRequiredOnSuccess: boolean
}

interface ChallengeState {
  challengeId: string
  deliveryDestination: string | null
  expiresAtUtc: string | null
  mockCodePreview: string | null
}

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const verificationSchema = z.object({
  code: z.string().min(4),
})

const EMPTY_SECURITY_STATE: SecurityState = {
  secondFactorRequiredOnSuccess: false,
}

const LOGIN_LOGO_LIGHT_SRC = '/tire-belediyesi-logo.png'
const LOGIN_LOGO_DARK_SRC = '/tire-belediyesi-logo.png'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { completeInteractiveSignIn } = useAuth()
  const { setAppearance, resetAppearance } = useTenantTheme()
  const [tenantContext, setTenantContext] = useState<TenantLoginContext | null>(null)
  const [selectedTenant, setSelectedTenant] = useState('')
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [, setSecurityState] = useState<SecurityState>(EMPTY_SECURITY_STATE)
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null)
  const [isTenantContextLoading, setIsTenantContextLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const autoProbeTenantRef = useRef<string | null>(null)
  const latestInteractiveRequestRef = useRef(0)
  const [showPassword, setShowPassword] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)

  const credentialsForm = useForm<z.infer<typeof credentialsSchema>>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const verificationForm = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: '',
    },
  })

  const tenants = tenantContext?.tenants ?? []
  const selectedTenantDetails = tenants.find(item => item.tenantId === selectedTenant) ?? null
  const hideTenantSelector = tenantContext?.hideTenantSelector ?? false
  const tenantSelectionRequired = tenantContext?.requireTenantSelection ?? false
  const isTenantReady = !!selectedTenant

  const institutionName = selectedTenantDetails?.displayName
    ?? selectedTenantDetails?.municipalityName
    ?? tenantContext?.resolvedTenant?.displayName
    ?? tenantContext?.resolvedTenant?.municipalityName
    ?? t('login.organizationFallback')
  const municipalityName = institutionName.replace(/\s+Belediyesi?$/i, '').trim()
  // Login sayfasında her zaman resmi Tire Belediyesi logosu kullanılır
  // (tenant görünüm logosu burada geçersiz kılınır).
  const desktopLogoUrl = LOGIN_LOGO_LIGHT_SRC
  const compactLogoUrl = LOGIN_LOGO_DARK_SRC
  const loginBackgroundImageUrl = tenantContext?.appearance?.loginBackgroundImageUrl?.trim() || null
  const loginHeroBackgroundStyle = loginBackgroundImageUrl
    ? {
      backgroundImage: `linear-gradient(145deg, var(--color-header-from), var(--color-header-to)), url("${loginBackgroundImageUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundBlendMode: 'multiply',
    } as const
    : {
      background: 'linear-gradient(145deg, var(--color-header-from), var(--color-header-to))',
    } as const

  const applyTenantContext = useEffectEvent((data: TenantLoginContext) => {
    const resolvedTenantId = data.resolvedTenant?.tenantId ?? data.tenants[0]?.tenantId ?? ''

    setTenantContext(data)
    setSelectedTenant(resolvedTenantId)
    setAppearance(data.appearance)
  })

  const handleTenantContextError = useEffectEvent((loadError: unknown) => {
    setError(loadError instanceof Error ? loadError.message : t('errors.tenantLoadFailed'))
    resetAppearance()
  })

  useEffect(() => {
    let isActive = true
    document.body.classList.add('login-screen')

    const loadTenantContext = async () => {
      setIsTenantContextLoading(true)

      try {
        const data = await getTenantLoginContext()
        if (!isActive) {
          return
        }

        applyTenantContext(data)
      } catch (loadError) {
        if (!isActive) {
          return
        }

        handleTenantContextError(loadError)
      } finally {
        if (isActive) {
          setIsTenantContextLoading(false)
        }
      }
    }

    void loadTenantContext()

    return () => {
      isActive = false
      document.body.classList.remove('login-screen')
    }
  }, [])

  const getTenantDisplayName = () => {
    return selectedTenantDetails?.displayName
      ?? selectedTenantDetails?.municipalityName
      ?? tenantContext?.resolvedTenant?.displayName
      ?? tenantContext?.resolvedTenant?.municipalityName
      ?? ''
  }

  const applyInteractiveResult = async (result: StartInteractiveAuthenticationResult) => {
    setSecurityState({
      secondFactorRequiredOnSuccess: result.secondFactorRequiredOnSuccess,
    })
    setNotice(result.message ?? '')
    setError('')

    if (result.status === 'ReadyToExchange') {
      if (!result.grant) {
        throw new Error(t('errors.invalidAuthResponse'))
      }

      await completeInteractiveSignIn(result.grant.username, result.grant.password, selectedTenant, getTenantDisplayName())
      setLoginSuccess(true)
      await new Promise(resolve => setTimeout(resolve, 420))
      navigate('/dashboard', { replace: true })
      return
    }

    if (result.status === 'SecondFactorRequired' && result.challengeId) {
      setChallengeState({
        challengeId: result.challengeId,
        deliveryDestination: result.deliveryDestination,
        expiresAtUtc: result.expiresAtUtc,
        mockCodePreview: result.mockCodePreview,
      })
      setLoginStep('secondFactor')
      return
    }

    if (result.status === 'Failed') {
      setNotice('')
      setError(result.message || t('errors.authFailed'))
    }

    setLoginStep('credentials')
  }

  const handleInteractiveResult = useEffectEvent(async (result: StartInteractiveAuthenticationResult) => {
    await applyInteractiveResult(result)
  })

  const runAutomaticProbe = useEffectEvent(async (tenantId: string, requestId: number) => {
    try {
      const response = await startInteractiveAuthentication(tenantId)
      if (requestId !== latestInteractiveRequestRef.current) {
        return
      }

      setSecurityState({
        secondFactorRequiredOnSuccess: response.secondFactorRequiredOnSuccess,
      })

      if (response.status === 'ReadyToExchange') {
        await handleInteractiveResult(response)
      }
    } catch {
      if (requestId !== latestInteractiveRequestRef.current) {
        return
      }

      setSecurityState(EMPTY_SECURITY_STATE)
    }
  })

  useEffect(() => {
    if (!selectedTenant || isTenantContextLoading) {
      if (!isTenantContextLoading) {
        setLoginStep('credentials')
        setSecurityState(EMPTY_SECURITY_STATE)
      }
      return
    }

    if (autoProbeTenantRef.current === selectedTenant) {
      return
    }

    autoProbeTenantRef.current = selectedTenant
    const requestId = ++latestInteractiveRequestRef.current
    const timeoutId = window.setTimeout(() => {
      void runAutomaticProbe(selectedTenant, requestId)
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isTenantContextLoading, selectedTenant])

  const handleTenantChange = (tenantId: string) => {
    latestInteractiveRequestRef.current += 1
    autoProbeTenantRef.current = null
    setSelectedTenant(tenantId)
    setNotice('')
    setError('')
    setSecurityState(EMPTY_SECURITY_STATE)
    setChallengeState(null)
    verificationForm.reset({ code: '' })
    setLoginStep('credentials')
  }

  return (
    <div className="flex min-h-dvh flex-col">
    <div className="flex flex-1 flex-col overflow-hidden lg:my-8 lg:mx-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:rounded-3xl lg:shadow-2xl xl:mx-[12.5%] xl:grid-cols-[minmax(0,1fr)_440px]">
        <section
          className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-7 lg:py-16 xl:px-8 2xl:px-12 2xl:py-20"
          style={loginHeroBackgroundStyle}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(197,154,55,0.18),transparent_28%)]" />
          <div className="relative grid gap-4 pt-2 2xl:gap-6 2xl:pt-4">
            <div className="space-y-3 2xl:space-y-5">
              {/* Logo solda; başlık tüm yeşil alana göre ortalanır (logoyu sağdaki eş genişlikte boşluk dengeler). */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 2xl:gap-5">
                <MunicipalitySeal
                  alt={`${institutionName} amblemi`}
                  src={desktopLogoUrl}
                  className="h-20 w-36 shrink-0 rounded-[1.1rem] border-0 bg-transparent 2xl:h-24 2xl:w-44"
                  imageClassName="h-[82%] w-[90%] drop-shadow-none"
                />
                <h1 className="text-center text-xl font-semibold leading-[1.1] text-white 2xl:text-3xl">
                  {t('shell.subtitle', { municipalityName })}
                </h1>
                <span aria-hidden className="h-14 w-36 shrink-0 2xl:h-16 2xl:w-44" />
              </div>
              <p className="max-w-2xl text-[0.82rem] leading-6 text-white/86 xl:text-sm xl:leading-6 2xl:text-base 2xl:leading-7">{t('login.subtitle')}</p>
            </div>
            <ul className="grid w-full gap-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] 2xl:max-w-[52rem] 2xl:gap-4">
              {[
                { icon: MessageSquareMore, title: t('login.heroCardCitizenRequests') },
                { icon: SquareKanban, title: t('login.heroCardInternalTracking') },
              ].map(item => {
                const Icon = item.icon
                return (
                  <li
                    key={item.title}
                    className="rounded-[1.2rem] border border-white/14 bg-white/[0.05] p-1.5 shadow-[0_14px_42px_rgba(0,0,0,0.14)] backdrop-blur 2xl:p-2"
                  >
                    <div className="flex min-h-[46px] items-center gap-2.5 rounded-[0.85rem] border border-white/14 bg-white/9 px-3.5 py-1.5 2xl:min-h-[56px] 2xl:gap-3.5 2xl:px-5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/14 bg-white/12 text-white 2xl:size-10">
                        <Icon className="size-4 2xl:size-6" />
                      </span>
                      <span className="whitespace-nowrap text-[0.8rem] font-semibold leading-snug text-white/95 2xl:text-base">{item.title}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="relative grid gap-3 rounded-[var(--radius-xl)] border border-white/12 bg-white/7 p-4 text-white/82">
            <div className="text-sm font-semibold text-white">{t('login.formDescription')}</div>
          </div>
        </section>

        <section
          className="flex items-center justify-center bg-[color:var(--color-surface)] px-[25%] py-5 lg:px-10 lg:py-8"
          style={{
            transition: 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.42s ease',
            transform: loginSuccess ? 'scale(0.78)' : 'scale(1)',
            opacity: loginSuccess ? 0.6 : 1,
          }}
        >
          <div className="w-full space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/55 px-4 py-4 lg:hidden">
              <MunicipalitySeal
                alt={`${institutionName} logo`}
                src={compactLogoUrl}
                className="h-36 w-36 border-0"
              />
              <div className="min-w-0 text-center">
                <div className="text-base font-bold text-slate-950">{t('shell.subtitle', { municipalityName })}</div>
              </div>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-edge)] sm:p-6">
              <div className="space-y-1">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
                  {t('login.organization')}
                </div>
                <h2 className="text-xl font-extrabold text-slate-950 sm:text-2xl">{t('login.formTitle')}</h2>
                <p className="text-sm leading-6 text-[color:var(--color-muted-foreground)]">{t('login.formDescription')}</p>
              </div>

              <div className="mt-5 space-y-4">
                {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
                {notice ? <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">{notice}</div> : null}

                {isTenantContextLoading ? <div className="rounded-xl border border-[var(--color-border)] bg-[color:var(--color-muted)]/65 px-4 py-4 text-sm font-medium text-[color:var(--color-muted-foreground)]">{t('login.loadingContext')}</div> : null}

                {!isTenantContextLoading && hideTenantSelector && selectedTenantDetails && tenants.length > 1 ? (
                  <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/6 p-4" data-testid="resolved-tenant-card">
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('login.organization')}</div>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-950">{institutionName}</h3>
                  </div>
                ) : null}

                {!isTenantContextLoading && !hideTenantSelector ? (
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('login.organization')}</span>
                    <select id="tenant" value={selectedTenant} className="field-select" onChange={event => handleTenantChange(event.target.value)}>
                      <option value="">{t('login.organizationPlaceholder')}</option>
                      {tenants.map(tenant => (
                        <option key={tenant.tenantId} value={tenant.tenantId}>{tenant.municipalityName}</option>
                      ))}
                    </select>
                    {tenantSelectionRequired ? <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">{t('login.selectTenantHelp')}</span> : null}
                  </label>
                ) : null}


                {loginStep === 'credentials' && !isTenantContextLoading ? (
                  <form
                    className="grid gap-3"
                    onSubmit={credentialsForm.handleSubmit(async values => {
                      setNotice('')
                      setError('')

                      if (!selectedTenant) {
                        setError(t('login.tenantRequired'))
                        return
                      }

                      const requestId = ++latestInteractiveRequestRef.current
                      setIsLoading(true)
                      try {
                        const response = await startInteractiveAuthentication(selectedTenant, values.username, values.password)
                        if (requestId !== latestInteractiveRequestRef.current) {
                          return
                        }

                        await applyInteractiveResult(response)
                      } catch (submitError) {
                        if (requestId !== latestInteractiveRequestRef.current) {
                          return
                        }

                        setError(submitError instanceof Error ? submitError.message : t('common.error'))
                      } finally {
                        if (requestId === latestInteractiveRequestRef.current) {
                          setIsLoading(false)
                        }
                      }
                    })}
                  >
                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      <span>{t('login.username')}</span>
                      <input id="username" className="field-input" autoComplete="username" aria-invalid={!!credentialsForm.formState.errors.username} aria-describedby={credentialsForm.formState.errors.username ? 'username-error' : undefined} {...credentialsForm.register('username')} />
                      {credentialsForm.formState.errors.username ? <span id="username-error" className="text-xs font-medium text-rose-600">{t('login.usernameRequired')}</span> : null}
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      <span>{t('login.password')}</span>
                      <div className="relative">
                        <input id="password" type={showPassword ? 'text' : 'password'} className="field-input pr-10" autoComplete="current-password" aria-invalid={!!credentialsForm.formState.errors.password} aria-describedby={credentialsForm.formState.errors.password ? 'password-error' : undefined} {...credentialsForm.register('password')} />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}>
                          {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                        </button>
                      </div>
                      {credentialsForm.formState.errors.password ? <span id="password-error" className="text-xs font-medium text-rose-600">{t('login.passwordRequired')}</span> : null}
                    </label>

                    <Button type="submit" size="lg" className="mt-1 w-full" disabled={isLoading || !isTenantReady}>
                      {isLoading ? t('login.submitting') : t('login.submit')}
                    </Button>
                  </form>
                ) : null}

                {loginStep === 'secondFactor' && challengeState ? (
                  <form
                    className="grid gap-3"
                    onSubmit={verificationForm.handleSubmit(async values => {
                      if (!challengeState) {
                        return
                      }

                      const requestId = ++latestInteractiveRequestRef.current
                      setIsLoading(true)
                      setError('')
                      try {
                        const result = await verifyInteractiveAuthentication(selectedTenant, challengeState.challengeId, values.code)
                        if (requestId !== latestInteractiveRequestRef.current) {
                          return
                        }

                        if (result.status !== 'ReadyToExchange' || !result.grant) {
                          setError(result.message || t('errors.authFailed'))
                          return
                        }

                        await completeInteractiveSignIn(result.grant.username, result.grant.password, selectedTenant, getTenantDisplayName())
                        setLoginSuccess(true)
                        await new Promise(resolve => setTimeout(resolve, 420))
                        navigate('/dashboard', { replace: true })
                      } catch (verifyError) {
                        if (requestId !== latestInteractiveRequestRef.current) {
                          return
                        }

                        setError(verifyError instanceof Error ? verifyError.message : t('common.error'))
                      } finally {
                        if (requestId === latestInteractiveRequestRef.current) {
                          setIsLoading(false)
                        }
                      }
                    })}
                  >
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-slate-950">{t('login.secondFactorTitle')}</h3>
                      <p className="text-sm leading-6 text-[color:var(--color-muted-foreground)]">{t('login.secondFactorSubtitle')}</p>
                    </div>

                    <div className="grid gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/6 p-4 text-sm text-[color:var(--color-muted-foreground)]">
                      {challengeState.deliveryDestination ? <span>{t('login.deliveryDestination')}: {challengeState.deliveryDestination}</span> : null}
                      {challengeState.expiresAtUtc ? <span>{t('login.expiresAt')}: {new Date(challengeState.expiresAtUtc).toLocaleTimeString()}</span> : null}
                    </div>

                    {challengeState.mockCodePreview ? (
                      <div className="rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">{t('login.mockPreviewTitle')}</div>
                        <div className="mock-code-value mt-3 text-3xl font-semibold tracking-[0.3em]">{challengeState.mockCodePreview}</div>
                      </div>
                    ) : null}

                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      <span>{t('login.verificationCode')}</span>
                      <input className="field-input" inputMode="numeric" autoComplete="one-time-code" {...verificationForm.register('code')} />
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button type="submit" size="lg" disabled={isLoading}>{isLoading ? t('login.verifying') : t('login.verify')}</Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          latestInteractiveRequestRef.current += 1
                          setChallengeState(null)
                          verificationForm.reset({ code: '' })
                          setLoginStep('credentials')
                          setNotice('')
                          setError('')
                        }}
                      >
                        {t('login.editCredentials')}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>

            {/* Privacy policy link */}
            <p className="text-center text-xs text-slate-400">
              Bu sistemi kullanarak{' '}
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(true)}
                className="font-semibold text-[color:var(--color-primary)] underline-offset-2 hover:underline"
              >
                Gizlilik Politikası
              </button>
              'nı kabul etmiş sayılırsınız.
            </p>
          </div>
        </section>

    </div>{/* end inner grid */}
    <AppFooter />
      {/* Privacy Policy Modal */}
      {isPrivacyOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsPrivacyOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setIsPrivacyOpen(false) }}
          role="dialog"
          aria-modal="true"
          aria-label="Gizlilik Politikası"
        >
          <div
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-secondary)] px-6 py-4">
              <ShieldCheck className="size-5 shrink-0 text-white/80" />
              <h2 className="flex-1 text-base font-extrabold text-white">Gizlilik Politikası</h2>
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(false)}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-7 text-slate-700 space-y-5">

              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Son güncelleme: {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">1. Veri Sorumlusu</h3>
                <p>
                  {institutionName} ("Belediye"), 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla,
                  bu platformu kullanan personel ve yetkilendirilmiş kullanıcılara ait kişisel verileri işlemektedir.
                </p>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">2. İşlenen Kişisel Veriler</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Kimlik bilgileri: Ad, soyad, kullanıcı adı</li>
                  <li>İletişim bilgileri: Kurumsal e-posta adresi, dahili telefon numarası</li>
                  <li>Sisteme erişim bilgileri: IP adresi, oturum açma tarihi/saati, kullanılan cihaz türü</li>
                  <li>İş ve görev bilgileri: Departman, unvan, atanan görev ve talepler</li>
                  <li>Sistem aktiviteleri: İşlem geçmişi, denetim kayıtları (audit log)</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">3. Kişisel Verilerin İşlenme Amaçları</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Kurumsal iletişim ve iş akışlarının yönetilmesi</li>
                  <li>Vatandaş talepleri ile görevlerin takip edilmesi ve sonuçlandırılması</li>
                  <li>Sistem güvenliğinin ve erişim denetiminin sağlanması</li>
                  <li>Yasal yükümlülüklerin yerine getirilmesi</li>
                  <li>İstatistiksel raporlama ve hizmet kalitesinin iyileştirilmesi</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">4. Hukuki Dayanak</h3>
                <p>
                  Kişisel verileriniz; KVKK'nın 5. maddesi uyarınca <strong>kanunlarda açıkça öngörülmesi</strong>,
                  <strong> bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması</strong> ve
                  <strong> veri sorumlusunun meşru menfaati</strong> hukuki sebeplerine dayanılarak işlenmektedir.
                </p>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">5. Verilerin Aktarımı</h3>
                <p>
                  Kişisel verileriniz; yetkili kamu kurum ve kuruluşları ile yasal zorunluluklar çerçevesinde
                  paylaşılabilir. Üçüncü taraflarla ticari amaçlarla paylaşılmaz.
                </p>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">6. Saklama Süresi</h3>
                <p>
                  Kişisel verileriniz, ilgili mevzuatta öngörülen süreler ve kurumsal saklama politikaları
                  çerçevesinde saklanmakta; bu sürelerin dolması halinde güvenli biçimde imha edilmektedir.
                </p>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">7. KVKK Kapsamındaki Haklarınız</h3>
                <p className="mb-1.5">KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                  <li>İşlenmişse buna ilişkin bilgi talep etme</li>
                  <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                  <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
                  <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
                  <li>KVKK'nın 7. maddesi çerçevesinde silinmesini veya yok edilmesini isteme</li>
                  <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla aleyhinize sonuç doğurmasına itiraz etme</li>
                  <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1.5 text-sm font-extrabold text-slate-900">8. İletişim</h3>
                <p>
                  Haklarınızı kullanmak veya gizlilik politikamız hakkında bilgi almak için kurumun
                  veri sorumlusu temsilcisine başvurabilirsiniz.
                </p>
              </section>

            </div>

            {/* Modal footer */}
            <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-6 py-3.5 text-right">
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-primary)] px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
