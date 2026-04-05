import { ArrowUpRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Badge>{t('pages.placeholder.badge')}</Badge>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-slate-950">{title}</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">{description}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[color:var(--color-primary)]/12 text-[color:var(--color-primary)]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <CardTitle>{t('pages.placeholder.title')}</CardTitle>
              <CardDescription>{t('pages.placeholder.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Button type="button">{t('pages.placeholder.primaryAction')}</Button>
          <Button type="button" variant="secondary">
            <ArrowUpRight className="size-4" />
            {t('pages.placeholder.secondaryAction')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
