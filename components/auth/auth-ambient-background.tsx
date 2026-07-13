/** Soft charcoal mesh — cool steel light pools for auth pages. */
export function AuthAmbientBackground() {
  return (
    <>
      {/* Base depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[oklch(0.12_0_0)]"
      />

      {/* Cool steel mesh pools */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 55% at 50% 18%, oklch(0.42 0.02 250 / 0.45), transparent 70%)",
            "radial-gradient(ellipse 45% 40% at 18% 72%, oklch(0.36 0.025 230 / 0.35), transparent 72%)",
            "radial-gradient(ellipse 50% 45% at 88% 58%, oklch(0.34 0.02 210 / 0.28), transparent 70%)",
            "radial-gradient(ellipse 90% 60% at 50% 100%, oklch(0.22 0.01 250 / 0.55), transparent 65%)",
          ].join(", "),
        }}
      />

      {/* Soft center bloom behind logo/form */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.55_0.03_240_/0.12)] blur-3xl max-sm:h-[18rem] max-sm:w-[18rem] max-sm:top-[36%]"
      />

      {/* Slow breathing glow — lighter on mobile for battery/GPU */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[22rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.62_0.04_250_/0.08)] blur-3xl motion-safe:animate-[auth-mesh-breathe_10s_ease-in-out_infinite] max-sm:h-[14rem] max-sm:w-[20rem] max-sm:opacity-70 max-sm:motion-safe:animate-none"
      />

      {/* Hairline grid, very quiet */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.85 0 0) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.85 0 0) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black 20%, transparent 75%)",
        }}
      />

      {/* Edge vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,oklch(0.08_0_0_/0.85)_100%)]"
      />
    </>
  );
}
