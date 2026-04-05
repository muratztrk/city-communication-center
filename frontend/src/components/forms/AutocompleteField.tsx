import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export interface AutocompleteOption {
  id: string
  label: string
  description?: string
  helperText?: string
  badgeText?: string
  disabled?: boolean
}

interface AutocompleteFieldProps {
  ariaLabel: string
  placeholder: string
  value: string
  options: AutocompleteOption[]
  emptyMessage: string
  loadingMessage: string
  onValueChange: (value: string) => void
  onOptionSelect: (option: AutocompleteOption) => void
  disabled?: boolean
  isLoading?: boolean
}

function findNextEnabledIndex(options: AutocompleteOption[], startIndex: number, direction: 1 | -1): number {
  if (options.length === 0) {
    return -1
  }

  let index = startIndex

  for (let iteration = 0; iteration < options.length; iteration += 1) {
    index = (index + direction + options.length) % options.length
    if (!options[index]?.disabled) {
      return index
    }
  }

  return -1
}

export function AutocompleteField({
  ariaLabel,
  placeholder,
  value,
  options,
  emptyMessage,
  loadingMessage,
  onValueChange,
  onOptionSelect,
  disabled = false,
  isLoading = false,
}: AutocompleteFieldProps) {
  const generatedId = useId()
  const listboxId = `${generatedId}-listbox`
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const enabledOptions = useMemo(() => options.filter(option => !option.disabled), [options])
  const defaultHighlightedIndex = enabledOptions.length > 0 ? options.findIndex(option => !option.disabled) : -1
  const activeHighlightedIndex = highlightedIndex >= 0 && !options[highlightedIndex]?.disabled
    ? highlightedIndex
    : defaultHighlightedIndex

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const highlightedOption = activeHighlightedIndex >= 0 ? options[activeHighlightedIndex] : null

  const selectOption = (option: AutocompleteOption) => {
    if (option.disabled) {
      return
    }

    onOptionSelect(option)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true)
      setHighlightedIndex(defaultHighlightedIndex)
      event.preventDefault()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex(currentIndex => findNextEnabledIndex(options, currentIndex >= 0 ? currentIndex : activeHighlightedIndex, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex(currentIndex => findNextEnabledIndex(options, currentIndex >= 0 ? currentIndex : activeHighlightedIndex, -1))
      return
    }

    if (event.key === 'Enter' && isOpen && highlightedOption) {
      event.preventDefault()
      selectOption(highlightedOption)
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div className={cn('relative min-w-[12rem]', disabled && 'opacity-70')} ref={wrapperRef}>
      <input
        aria-activedescendant={highlightedOption ? `${generatedId}-${highlightedOption.id}` : undefined}
        aria-autocomplete="list"
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className="field-input w-full"
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={value}
        onChange={event => {
          onValueChange(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)]" id={listboxId} role="listbox">
          {isLoading ? (
            <div className="rounded-xl px-3 py-3 text-sm text-slate-500">{loadingMessage}</div>
          ) : options.length === 0 ? (
            <div className="rounded-xl px-3 py-3 text-sm text-slate-500">{emptyMessage}</div>
          ) : (
            options.map((option, index) => (
              <div
                aria-disabled={option.disabled || undefined}
                aria-selected={activeHighlightedIndex === index}
                className={cn(
                  'rounded-xl px-3 py-3 transition',
                  activeHighlightedIndex === index && 'bg-slate-100',
                  option.disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-slate-100',
                )}
                id={`${generatedId}-${option.id}`}
                key={option.id}
                role="option"
                onClick={() => selectOption(option)}
                onMouseDown={event => event.preventDefault()}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                  {option.badgeText ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {option.badgeText}
                    </span>
                  ) : null}
                </div>
                {option.description ? <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div> : null}
                {option.helperText ? <div className="mt-1 text-xs leading-5 text-sky-700">{option.helperText}</div> : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}