// Central theme tokens — the ONLY place that may contain literal design values.
// tailwind.config.ts and src/theme/tokens.css derive from this object.
// Source: design/system-design.md ("Disciplined Civic Network").

export const tokens = {
  colors: {
    primary: '#6D28D9',
    primaryHover: '#5B21B6',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    border: '#E2E8F0',
    borderMuted: '#F1F5F9',
    // Status discipline: green = verification only, amber = pending only.
    success: '#16A34A',
    pending: '#F59E0B',
    error: '#DC2626',
    ink: '#0F172A',
    inkMuted: '#64748B',
  },
  radii: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
} as const;

export type ThemeTokens = typeof tokens;
