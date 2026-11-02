// Central theme tokens — the ONLY place that may contain literal design values.
// tailwind.config.ts and src/theme/tokens.css derive from this object.
// Source: design/system-design.md ("Disciplined Civic Network"), restyled to the
// warm Basmatak light identity. `gold` is the single swappable brand-gold token;
// sample the logo with an eyedropper and change only this value (plus its dark
// equivalent) to retune the identity.
//
// Usage rules encoded here:
// - background is the page canvas; surface is a raised card; surfaceMuted is a
//   quiet inset block (never the page canvas).
// - primary is the near-black action/text colour (primary buttons, user bubble).
// - gold is a fill/accent only and always pairs with onGold (black) text.
// - goldStrong is the only token for gold-coloured text, links and active states.
// - goldSoft is a quiet warm highlight behind active nav rows and key icons.
// - success stays reserved for verification/positive functional states.

export const tokens: {
  colors: Record<string, string>;
  radii: Record<string, string>;
  fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]>;
  shadows: Record<string, string>;
  layout: Record<string, string>;
} = {
  colors: {
    // Page canvas and flat surfaces.
    background: '#FBF9F4',
    surface: '#FFFFFF',
    surfaceMuted: '#F4F0E6',
    border: '#E9E3D3',
    borderMuted: '#F2EDE2',
    // Near-black primary action/text colour.
    primary: '#14110D',
    primaryHover: '#2A251E',
    // Foreground paired with primary fills (user bubble, send/launcher).
    onPrimary: '#FFFFFF',
    // Main brand gold: fills and key accents only, always with onGold text.
    gold: '#D4A62A',
    goldHover: '#C29622',
    // Gold-coloured text, links, active states and the focus ring.
    goldStrong: '#8A6508',
    // Quiet warm highlight: active nav rows, contextual highlights.
    goldSoft: '#F6ECCB',
    // Text/icon colour used on gold fills. Black in both modes.
    onGold: '#14110D',
    // Status discipline: green = verification only, amber = pending only.
    success: '#2D6A4F',
    onSuccess: '#FFFFFF',
    pending: '#F59E0B',
    // Functional error red stays for inline validation. errorWarm is the calm
    // brick red reserved for error toasts (border/icon only, never copy).
    error: '#DC2626',
    errorWarm: '#B44034',
    onError: '#FFFFFF',
    ink: '#14110D',
    // Warm gray, 7.01:1 on the #FBF9F4 canvas.
    inkMuted: '#5C5548',
    // Warm black scrim for content placed over photography.
    overlay: '#14110D',
    onOverlay: '#FFFFFF',
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
  // Fixed shell measurements shared by layout and overlays (toast offset).
  layout: {
    headerHeight: '4rem',
  },
};

export type ThemeTokens = typeof tokens;

// Dark equivalents. Explicit opt-in only (html[data-theme='dark']): warm
// near-black canvas, warm raised cards, off-white text, lighter golds, and
// status colours lifted enough to stay readable on the dark canvas. Utilities
// follow the CSS variables, so components need no dark: variants.
export const darkTokens: Pick<ThemeTokens, 'colors'> = {
  colors: {
    background: '#14110D',
    surface: '#211D17',
    surfaceMuted: '#1B1712',
    border: '#3A342A',
    borderMuted: '#2C2820',
    primary: '#F5F0E6',
    primaryHover: '#FFFFFF',
    onPrimary: '#14110D',
    gold: '#E4BC4E',
    goldHover: '#EFCB6B',
    goldStrong: '#E0B84A',
    goldSoft: '#2A251D',
    onGold: '#14110D',
    success: '#7FC49A',
    onSuccess: '#14110D',
    pending: '#F59E0B',
    error: '#F87171',
    errorWarm: '#EE9A8B',
    onError: '#14110D',
    ink: '#F5F0E6',
    inkMuted: '#B8AD9B',
    overlay: '#14110D',
    onOverlay: '#FFFFFF',
  },
};

// Tailwind colour values backed by the CSS channel variables in tokens.css.
// Channel form keeps Tailwind opacity modifiers (bg-primary/5) working while
// allowing the same utility to switch palette in dark mode.
const channel = (name: string): string =>
  `rgb(var(--color-${name}-rgb) / <alpha-value>)`;

export const cssVariables = {
  background: channel('background'),
  surface: channel('surface'),
  surfaceMuted: channel('surface-muted'),
  border: channel('border'),
  borderMuted: channel('border-muted'),
  primary: channel('primary'),
  primaryHover: channel('primary-hover'),
  onPrimary: channel('on-primary'),
  gold: channel('gold'),
  goldHover: channel('gold-hover'),
  goldStrong: channel('gold-strong'),
  goldSoft: channel('gold-soft'),
  onGold: channel('on-gold'),
  success: channel('success'),
  onSuccess: channel('on-success'),
  pending: channel('pending'),
  error: channel('error'),
  errorWarm: channel('error-warm'),
  onError: channel('on-error'),
  ink: channel('ink'),
  inkMuted: channel('ink-muted'),
  overlay: channel('overlay'),
  onOverlay: channel('on-overlay'),
} as const;
