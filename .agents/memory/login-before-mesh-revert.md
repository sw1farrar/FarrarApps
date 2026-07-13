# Login before soft charcoal mesh (revert point)

**When user says:** revert / restore login before mesh / undo the mesh background

**Snapshot path:** `components/auth/_snapshots/login-before-mesh-2026-07-12/`

**Remembered look (2026-07-12, immediately before option 1 mesh):**
- Page: `bg-background` + top radial glow + faint 48px grid
- Centered `max-w-[22rem]`
- Transparent sign-in stack (no card bg/border/blur)
- Logo full-width at top of stack (`farrar_apps_logo.png?v=3`)
- No “Sign in” / “Workspace access” headings
- “Remember this computer” only (no “Uncheck on shared…” line)
- Sign in button only (no Create account)
- Device verify page same page chrome + transparent form

**Restore:** copy snapshot files over:
- `login-form.tsx` → `components/auth/login-form.tsx`
- `device-verify-form.tsx` → `components/auth/device-verify-form.tsx`
- `login-page.tsx` → `app/login/page.tsx`
- `verify-page.tsx` → `app/login/verify/page.tsx`

Note: older panel snapshot still exists at `login-with-panel-2026-07-12` (card with bg). This mesh revert is the transparent look.
