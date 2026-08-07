import { startTransition, useEffect, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** Controlled input — parent state güncellemesi startTransition ile ertelenir. */
export function DeferredComposerInput({ value, onChange, ...rest }: Props) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <input
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
