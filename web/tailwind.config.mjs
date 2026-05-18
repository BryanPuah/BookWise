/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mirrors src/theme.js — Paper background + light-mode ink + olive accent.
        paper: '#F8F6F2',
        ink: {
          DEFAULT: '#1A1E3A',
          soft:    '#3A3E5A',
          muted:   '#5C5F76',
          faint:   '#878A9E',
        },
        accent: {
          DEFAULT: '#7A8B5E',
          pale:    '#E8EDE0',
          deep:    '#5F6D49',
        },
        line:     'rgba(26,30,58,0.10)',
        'line-mid': 'rgba(26,30,58,0.16)',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans:  ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft:   '0 4px 12px rgba(26,30,58,0.06)',
        lift:   '0 8px 24px rgba(26,30,58,0.10)',
        strong: '0 12px 32px rgba(26,30,58,0.18)',
      },
      borderRadius: {
        card: '14px',
        hero: '20px',
      },
      maxWidth: {
        prose: '38rem',
      },
    },
  },
  plugins: [],
};
