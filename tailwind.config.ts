import type { Config } from 'tailwindcss';
import { cssVariables, tokens } from './src/theme/tokens';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: cssVariables.background,
        surface: {
          DEFAULT: cssVariables.surface,
          muted: cssVariables.surfaceMuted,
        },
        border: {
          DEFAULT: cssVariables.border,
          muted: cssVariables.borderMuted,
        },
        primary: {
          DEFAULT: cssVariables.primary,
          hover: cssVariables.primaryHover,
        },
        'on-primary': cssVariables.onPrimary,
        gold: {
          DEFAULT: cssVariables.gold,
          hover: cssVariables.goldHover,
          strong: cssVariables.goldStrong,
          soft: cssVariables.goldSoft,
        },
        'on-gold': cssVariables.onGold,
        status: {
          success: cssVariables.success,
          pending: cssVariables.pending,
          error: cssVariables.error,
          'error-warm': cssVariables.errorWarm,
        },
        'on-success': cssVariables.onSuccess,
        'on-error': cssVariables.onError,
        ink: {
          DEFAULT: cssVariables.ink,
          muted: cssVariables.inkMuted,
        },
        overlay: cssVariables.overlay,
        'on-overlay': cssVariables.onOverlay,
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-tajawal)', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: tokens.radii.sm,
        md: tokens.radii.md,
        lg: tokens.radii.lg,
      },
      fontSize: tokens.fontSize,
      boxShadow: {
        sm: tokens.shadows.sm,
        raised: tokens.shadows.raised,
        modal: tokens.shadows.modal,
      },
    },
  },
  plugins: [],
};

export default config;
