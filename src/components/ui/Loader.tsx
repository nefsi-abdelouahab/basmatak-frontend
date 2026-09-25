export interface LoaderProps {
  label: string;
}

export function Loader({ label }: LoaderProps) {
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center p-6">
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border-muted border-t-primary" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
