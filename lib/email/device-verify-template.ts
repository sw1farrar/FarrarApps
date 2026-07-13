function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildDeviceVerifyEmail(input: {
  code: string;
  toName?: string | null;
  companyName?: string;
}) {
  const companyName = input.companyName || "Farrar Apps";
  const name = escapeHtml(input.toName || "there");
  const code = escapeHtml(input.code);

  const htmlContent = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0b0b0b;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div style="font-size:20px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(companyName)}</div>
        <div style="font-size:16px;font-weight:700;letter-spacing:0.18em;color:#d4d4d4;">APPS</div>
      </div>
      <div style="background:#141414;border:1px solid #262626;border-radius:12px;padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
        <p style="margin:0 0 16px;color:#d4d4d4;font-size:14px;line-height:1.5;">
          We noticed a sign-in from a computer we don’t recognize. Enter this code to confirm it’s you:
        </p>
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;letter-spacing:0.35em;font-size:28px;font-weight:700;background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:14px 22px;">
            ${code}
          </div>
        </div>
        <p style="margin:0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          This code expires in 10 minutes. If you didn’t try to sign in, you can ignore this email.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = `Hi ${input.toName || "there"},

Your Farrar Apps verification code is: ${input.code}

It expires in 10 minutes. If you didn't try to sign in, ignore this email.`;

  return {
    subject: `${companyName} sign-in verification code`,
    htmlContent,
    textContent,
  };
}
