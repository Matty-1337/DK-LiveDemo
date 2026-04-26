// Delta Kinetics brand tokens. Mirrors styles/tokens.css. Use this when a
// component needs a token at runtime (e.g. dynamic style on a popup).
// For static styling, prefer the CSS variables in tokens.css.

export const dk = {
  bg: '#0A1420',
  bgElevated: '#0F1B2C',
  surface: 'rgba(20, 33, 51, 0.72)',
  surfaceBorder: 'rgba(64, 240, 240, 0.28)',

  cyan: '#40F0F0',
  magenta: '#E040C0',

  textPrimary: '#FFFFFF',
  textSecondary: '#B6E2FF',
  textMuted: 'rgba(255, 255, 255, 0.62)',

  gradient: 'linear-gradient(90deg, #92F7FC 0%, #B6E2FF 100%)',

  fontSans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontMono: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',

  radius: '14px',
  radiusLg: '20px',
  shadow: '0 18px 50px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(64, 240, 240, 0.15)',
} as const;
