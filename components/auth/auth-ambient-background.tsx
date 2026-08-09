/** Cursor Dark charcoal mesh for auth pages. */
export function AuthAmbientBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#141414]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 55% at 50% 18%, rgba(245, 78, 0, 0.12), transparent 70%)",
            "radial-gradient(ellipse 45% 40% at 18% 72%, rgba(30, 30, 30, 0.9), transparent 72%)",
            "radial-gradient(ellipse 50% 45% at 88% 58%, rgba(42, 42, 42, 0.55), transparent 70%)",
            "radial-gradient(ellipse 90% 60% at 50% 100%, rgba(10, 10, 10, 0.75), transparent 65%)",
          ].join(", "),
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(245,78,0,0.08)] blur-3xl max-sm:h-[18rem] max-sm:w-[18rem] max-sm:top-[36%]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[22rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(228,228,228,0.04)] blur-3xl motion-safe:animate-[auth-mesh-breathe_10s_ease-in-out_infinite] max-sm:h-[14rem] max-sm:w-[20rem] max-sm:opacity-70 max-sm:motion-safe:animate-none"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e4e4e4 1px, transparent 1px), linear-gradient(to bottom, #e4e4e4 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black 20%, transparent 75%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.72)_100%)]"
      />
    </>
  );
}
