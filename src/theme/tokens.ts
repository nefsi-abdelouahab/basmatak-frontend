// Central theme tokens — the ONLY place that may contain literal design values.
// tailwind.config.ts and src/theme/tokens.css derive from this object.
// Source: design/system-design.md ("Disciplined Civic Network").

export const tokens: {
  colors: Record<string, string>;
  radii: Record<string, string>;
  fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]>;
  shadows: Record<string, string>;
} = {
  colors: {
    primary: '#6D28D9',
    primaryHover: '#5B21B6',
    // Tint: active nav fills, contextual highlights, subtle focus backdrops.
    tint: '#F5F3FF',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    border: '#E2E8F0',
    borderMuted: '#F1F5F9',
    // Status discipline: green = verification only, amber = pending only.
    success: '#16A34A',
    pending: '#F59E0B',
    error: '#DC2626',
    ink: '#111827',
    inkMuted: '#64748B',
  },
  radii: {
    // Micro (chips, status pills): 6px. Input/button: 8px. Cards: 12px.
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  // Type scale from design/system-design.md frontmatter. Weight governance:
  // 400 body, 500 triggers/labels, 600 headlines. No 700+ display weights.
  fontSize: {
    'display-lg': ['30px', { lineHeight: '38px', fontWeight: '600' }],
    'headline-lg': ['24px', { lineHeight: '32px', fontWeight: '600' }],
    'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
    'title-lg': ['18px', { lineHeight: '26px', fontWeight: '600' }],
    'title-md': ['16px', { lineHeight: '24px', fontWeight: '600' }],
    'title-sm': ['15px', { lineHeight: '22px', fontWeight: '500' }],
    'body-lg': ['15px', { lineHeight: '23px', fontWeight: '400' }],
    'body-md': ['14px', { lineHeight: '21px', fontWeight: '400' }],
    'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
    'label-md': ['14px', { lineHeight: '20px', fontWeight: '500' }],
    'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
    'label-xs': ['11px', { lineHeight: '14px', fontWeight: '500' }],
  },
  // Depth is tonal + hairline borders; shadows stay restrained.
  shadows: {
    sm: '0 1px 2px 0 rgba(17, 24, 39, 0.04)',
    raised: '0 4px 6px -1px rgba(17, 24, 39, 0.07), 0 2px 4px -2px rgba(17, 24, 39, 0.05)',
    modal: '0 10px 15px -3px rgba(17, 24, 39, 0.08)',
  },
};

export type ThemeTokens = typeof tokens;
