# Login panel look (revert point)

**When user says:** restore / revert the sign-in panel look / put the background back on the login box

**Snapshot path:** `components/auth/_snapshots/login-with-panel-2026-07-12/`

**Remembered look (2026-07-12):**
- Centered `max-w-[22rem]` on dark grid + radial page background
- Card: `rounded-lg border border-border/60 bg-card/70 backdrop-blur-sm`
- Logo in card header with `border-b`, `px-4 pt-4 pb-3`, full-width trimmed transparent logo `?v=3`
- No “Sign in” / “Workspace access” headings
- Compact form in `p-4` below header

**Restore:** copy snapshot files over live paths (`login-form.tsx`, `device-verify-form.tsx`, `login-page.tsx` → `app/login/page.tsx`, `verify-page.tsx` → `app/login/verify/page.tsx`).
