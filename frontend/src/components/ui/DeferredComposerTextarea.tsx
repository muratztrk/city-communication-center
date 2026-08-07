import { startTransition, useEffect, useState, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/**
 * Controlled textarea that updates the input immediately while deferring parent
 * state updates (heavy WA/modal trees) via startTransition — klavye gecikmesini keser.
 */
export function DeferredComposerTextarea({ value, onChange, ...rest }: Props) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <textarea
      {...rest}
      value={localValue}
      onChange={event => {
        const next = event.target.value
        setLocalValue(next)
        startTransition(() => onChange(next))
      }}
      onBlur={event => {
        onChange(localValue)
        rest.onBlur?.(event)
      }}
    />
  )
}
