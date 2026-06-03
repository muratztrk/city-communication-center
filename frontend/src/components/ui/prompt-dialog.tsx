import { useState } from 'react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './button'

export interface PromptDialogState {
  title: string
  label?: string
  placeholder?: string
  confirmLabel?: string
  required?: boolean
  onConfirm: (value: string) => void | Promise<void>
}

interface PromptDialogProps {
  state: PromptDialogState | null
  onClose: () => void
}

export function PromptDialog({ state, onClose }: PromptDialogProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  if (!state) return null

  const isRequired = state.required !== false
  const canConfirm = !isRequired || value.trim().length > 0

  const handleConfirm = () => {
    void Promise.resolve(state.onConfirm(value.trim()))
    setValue('')
    onClose()
  }

  const handleClose = () => {
    setValue('')
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && canConfirm) {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === 'Escape') handleClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold text-slate-900">{state.title}</h3>
        {state.label && <label className="mb-1 block text-sm font-medium text-slate-700">{state.label}</label>}
        <textarea
          className="field-textarea mb-4 w-full"
          rows={3}
          placeholder={state.placeholder ?? ''}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t('common.cancel', 'İptal')}
          </Button>
          <Button type="button" variant="primary" disabled={!canConfirm} onClick={handleConfirm}>
            {state.confirmLabel ?? t('common.confirm', 'Onayla')}
          </Button>
        </div>
      </div>
    </div>
  )
}
