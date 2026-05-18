# Bookwise landing

Static marketing site for the Bookwise app. Astro + Tailwind. Independent of the React Native project at the repo root — has its own `package.json` and build.

## Dev

```bash
cd web
npm install
npm run dev      # http://localhost:4321
```

## Build

```bash
npm run build    # outputs ./dist
npm run preview  # local preview of the production build
```

## Wiring the waitlist form

The form is a stub — submissions log to the browser console.
Replace the body of `submitEmail()` in `src/components/WaitlistForm.astro`
with a POST to your real endpoint (Resend audiences, Formspree,
Buttondown, ConvertKit, etc.) when ready.

## Design tokens

All colors, fonts, shadows, and radii live in `tailwind.config.mjs` and
mirror `../src/theme.js` (Paper background, ink scale, olive accent,
DM Serif Display). Update there to keep the web and app in sync.
