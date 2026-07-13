REVERT KEYWORD: restore login panel look / revert sign-in background

Saved: 2026-07-12 evening — preferred sign-in look BEFORE transparent panel.

Look remembered:
- Centered max-w-[22rem] column on dark grid + radial page bg
- Single rounded-lg card: border border-border/60, bg-card/70, backdrop-blur-sm
- Header inside card: border-b, px-4 pt-4 pb-3, logo full width (farrar_apps_logo.png?v=3, trimmed transparent PNG)
- No \"Sign in\" / \"Workspace access\" headings
- Form section p-4: compact email/password, remember checkbox, Sign in + Create account
- Verify page mirrors same chrome (logo header + code form)

Restore by copying files from this folder back over:
- components/auth/login-form.tsx
- components/auth/device-verify-form.tsx
- app/login/page.tsx
- app/login/verify/page.tsx
