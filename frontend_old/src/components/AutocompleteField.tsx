import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface AutocompleteOption {
  id: string;
  label: string;
  description?: string;
  helperText?: string;
  badgeText?: string;
  disabled?: boolean;
}

interface AutocompleteFieldProps {
  ariaLabel: string;
  placeholder: string;
  value: string;
  options: AutocompleteOption[];
  emptyMessage: string;
  loadingMessage: string;
  onValueChange: (value: string) => void;
  onOptionSelect: (option: AutocompleteOption) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

function findNextEnabledIndex(options: AutocompleteOption[], startIndex: number, direction: 1 | -1): number {
  if (options.length === 0) {
    return -1;
  }

  let index = startIndex;
  for (let iteration = 0; iteration < options.length; iteration += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return -1;
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
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const enabledOptions = useMemo(() => options.filter(option => !option.disabled), [options]);
  const defaultHighlightedIndex = enabledOptions.length > 0 ? options.findIndex(option => !option.disabled) : -1;
  const activeHighlightedIndex = highlightedIndex >= 0 && !options[highlightedIndex]?.disabled
    ? highlightedIndex
    : defaultHighlightedIndex;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const highlightedOption = activeHighlightedIndex >= 0 ? options[activeHighlightedIndex] : null;

  const selectOption = (option: AutocompleteOption) => {
    if (option.disabled) {
      return;
    }

    onOptionSelect(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
      setHighlightedIndex(defaultHighlightedIndex);
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex(currentIndex => findNextEnabledIndex(options, currentIndex >= 0 ? currentIndex : activeHighlightedIndex, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(currentIndex => findNextEnabledIndex(options, currentIndex >= 0 ? currentIndex : activeHighlightedIndex, -1));
      return;
    }

    if (event.key === 'Enter' && isOpen && highlightedOption) {
      event.preventDefault();
      selectOption(highlightedOption);
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className={`autocomplete-field ${disabled ? 'disabled' : ''}`} ref={wrapperRef}>
      <input
        aria-autocomplete="list"
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-activedescendant={highlightedOption ? `${generatedId}-${highlightedOption.id}` : undefined}
        className="autocomplete-input"
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={value}
        onChange={event => {
          onValueChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {isOpen && !disabled && (
        <div className="autocomplete-panel" id={listboxId} role="listbox">
          {isLoading ? (
            <div className="autocomplete-empty">{loadingMessage}</div>
          ) : options.length === 0 ? (
            <div className="autocomplete-empty">{emptyMessage}</div>
          ) : (
            options.map((option, index) => (
              <div
                aria-disabled={option.disabled || undefined}
                aria-selected={activeHighlightedIndex === index}
                className={`autocomplete-option ${activeHighlightedIndex === index ? 'highlighted' : ''} ${option.disabled ? 'disabled' : ''}`}
                id={`${generatedId}-${option.id}`}
                key={option.id}
                role="option"
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <div className="autocomplete-option-main">
                  <span className="autocomplete-option-label">{option.label}</span>
                  {option.badgeText ? <span className="autocomplete-option-badge">{option.badgeText}</span> : null}
                </div>
                {option.description ? <div className="autocomplete-option-description">{option.description}</div> : null}
                {option.helperText ? <div className="autocomplete-option-helper">{option.helperText}</div> : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}