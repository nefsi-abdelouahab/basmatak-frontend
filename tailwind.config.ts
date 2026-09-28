import type { Config } from 'tailwindcss';
import { tokens } from './src/theme/tokens';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: tokens.colors.primary,
          hover: tokens.colors.primaryHover,
          tint: tokens.colors.tint,
        },
        surface: {
          DEFAULT: tokens.colors.surface,
          muted: tokens.colors.surfaceMuted,
        },
        border: {
          DEFAULT: tokens.colors.border,
          muted: tokens.colors.borderMuted,
        },
        status: {
          success: tokens.colors.success,
          pending: tokens.colors.pending,
          error: tokens.colors.error,
        },
        ink: {
          DEFAULT: tokens.colors.ink,
          muted: tokens.colors.inkMuted,
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-plex-arabic)', 'system-ui', 'sans-serif'],
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
