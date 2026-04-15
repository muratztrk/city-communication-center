import { zodResolver } from '@hookform/resolvers/zod'
import { LayoutDashboard, MessageSquareMore, Shield, SquareKanban } from 'lucide-react'
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
  const [securityState, setSecurityState] = useState<SecurityState>(EMPTY_SECURITY_STATE)
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null)
  const [isTenantContextLoading, setIsTenantContextLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const autoProbeTenantRef = useRef<string | null>(null)
  const latestInteractiveRequestRef = useRef(0)

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
    <div className="min-h-dvh bg-[color:var(--color-background)] px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto grid max-w-[1320px] overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-soft)] lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,1.05fr)_440px]">
        <section
          className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-8 lg:py-8 xl:px-10"
          style={{
            background: 'linear-gradient(145deg, var(--color-header-from), var(--color-header-to))',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(197,154,55,0.18),transparent_28%)]" />
          <div className="relative grid gap-5">
            <div className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/88">
              {t('login.organizationFallback')}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <MunicipalitySeal alt={`${institutionName} logo`} />
                <div className="min-w-0">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/70">{t('shell.subtitle')}</div>
                  <h1 className="mt-1 max-w-xl text-3xl font-extrabold leading-[1.08] text-white xl:text-4xl">
                    {!isTenantContextLoading ? institutionName : t('login.title')}
                  </h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-white/84">{t('login.subtitle')}</p>
            </div>
            <div className="grid gap-2.5 xl:max-w-[44rem] xl:grid-cols-3">
              {[
                { icon: LayoutDashboard, title: t('login.heroCardDashboard') },
                { icon: SquareKanban, title: t('login.heroCardTasks') },
                { icon: MessageSquareMore, title: t('login.heroCardSocial') },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="rounded-[var(--radius-xl)] border border-white/12 bg-white/8 px-3.5 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                        <Icon className="size-4" />
                      </div>
                      <span className="text-sm font-semibold text-white/92">{item.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative grid gap-3 rounded-[var(--radius-xl)] border border-white/12 bg-white/7 p-4 text-white/82">
            <div className="text-sm font-semibold text-white">{t('login.formDescription')}</div>
            <div className="flex items-start gap-3 text-sm leading-6">
              <Shield className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]" />
              <span>{t('login.secondFactorNotice')}</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[color:var(--color-surface)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full max-w-[25rem] space-y-4">
            <div className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/55 px-4 py-3 lg:hidden">
              <MunicipalitySeal compact alt={`${institutionName} logo`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{institutionName}</div>
                <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">{t('shell.subtitle', { municipalityName: institutionName.replace(/\s+Belediyesi?$/i, '').trim() })}</div>
              </div>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-edge)] sm:p-6">
              <div className="space-y-1">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
                  {t('login.organization')}
                </div>
                <h2 className="text-2xl font-extrabold text-slate-950 sm:text-[2rem]">{t('login.formTitle')}</h2>
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

                {!isTenantContextLoading && loginStep === 'credentials' && securityState.secondFactorRequiredOnSuccess ? (
                  <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color:var(--color-muted)]/55 px-4 py-4 text-sm text-[color:var(--color-muted-foreground)] shadow-sm">
                    <div className="flex items-start gap-3">
                      <Shield className="mt-0.5 size-4 shrink-0 text-[color:var(--color-primary)]" />
                      <p className="leading-6">{t('login.secondFactorNotice')}</p>
                    </div>
                  </div>
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
                      <input id="username" className="field-input" autoComplete="username" {...credentialsForm.register('username')} />
                      {credentialsForm.formState.errors.username ? <span className="text-xs font-medium text-rose-600">{t('login.usernameRequired')}</span> : null}
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      <span>{t('login.password')}</span>
                      <input id="password" type="password" className="field-input" autoComplete="current-password" {...credentialsForm.register('password')} />
                      {credentialsForm.formState.errors.password ? <span className="text-xs font-medium text-rose-600">{t('login.passwordRequired')}</span> : null}
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
          </div>
        </section>
      </div>
    </div>
  )
}
