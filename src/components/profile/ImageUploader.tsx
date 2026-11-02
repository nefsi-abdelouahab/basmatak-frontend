'use client';

import { useRef, type ChangeEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';

export type ImageUploaderAspect = 'avatar' | 'banner' | 'logo' | 'cover';

export interface ImageUploaderProps {
  id: string;
  label: string;
  hint?: string;
  valueUrl: string | null;
  onSelect: (file: File) => void | Promise<void>;
  onFileError: (reason: 'type' | 'size') => void;
  accept?: string;
  aspect?: ImageUploaderAspect;
  buttonLabel: string;
  emptyLabel?: string;
  error?: string | null;
  uploading?: boolean;
  progress?: number | null;
  disabled?: boolean;
  testId?: string;
}

const ASPECT_CLASSES: Record<ImageUploaderAspect, string> = {
  avatar: 'h-24 w-24 rounded-full',
  banner: 'h-28 w-full rounded-lg sm:h-36',
  logo: 'h-20 w-20 rounded-xl',
  cover: 'h-32 w-full rounded-lg sm:h-40',
};

export function ImageUploader({
  id,
  label,
  hint,
  valueUrl,
  onSelect,
  accept = 'image/jpeg,image/png,image/webp',
  aspect = 'cover',
  buttonLabel,
  emptyLabel,
  error,
  uploading = false,
  progress = null,
  disabled = false,
  testId,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void onSelect(file);
  }

  return (
    <div data-testid={testId} className="min-w-0">
      <p className="mb-1 text-sm font-medium text-ink">{label}</p>
      {hint ? <p className="mb-2 text-sm text-ink-muted">{hint}</p> : null}
      <div
        className={`relative flex items-center justify-center overflow-hidden border border-border bg-surface-muted ${ASPECT_CLASSES[aspect]}`}
      >
        {valueUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={valueUrl}
            alt=""
            data-testid={testId ? `${testId}-preview` : undefined}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            data-testid={testId ? `${testId}-empty` : undefined}
            className="px-3 text-center text-sm text-ink-muted"
          >
            {emptyLabel ?? ''}
          </span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <Loader label={label} />
          </span>
        ) : null}
      </div>
      {uploading && progress !== null ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(0, Math.round(progress)))}
          aria-label={label}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, Math.round(progress)))}%` }}
          />
        </div>
      ) : null}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled || uploading}
        className="hidden"
        aria-label={label}
        onChange={onFile}
      />
      <div className="mt-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={16} aria-hidden="true" />
          {buttonLabel}
        </Button>
      </div>
      {error ? (
        <p data-testid={`${testId ?? id}-error`} className="mt-1 text-sm text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
