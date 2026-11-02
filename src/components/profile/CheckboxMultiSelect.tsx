'use client';

import { Checkbox } from '@/components/ui/Checkbox';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface CheckboxMultiSelectProps {
  id: string;
  label: string;
  hint?: string;
  options: readonly MultiSelectOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

/**
 * Localized multi-select for fact-set categories. Values are ids, but only
 * localized labels are ever visible.
 */
export function CheckboxMultiSelect({
  id,
  label,
  hint,
  options,
  selected,
  onChange,
  disabled = false,
  emptyLabel,
}: CheckboxMultiSelectProps) {
  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  }

  return (
    <fieldset id={id} className="min-w-0">
      <legend className="mb-1 block text-sm font-medium text-ink">{label}</legend>
      {hint ? <p className="mb-2 text-sm text-ink-muted">{hint}</p> : null}
      {options.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyLabel ?? ''}</p>
      ) : (
        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
          {options.map((option) => (
            <Checkbox
              key={option.value}
              id={`${id}-${option.value}`}
              label={option.label}
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}
