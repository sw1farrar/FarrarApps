function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildEmailChangeVerifyEmail(input: {
  code: string;
  toName?: string | null;
  newEmail: string;
  companyName?: string;
}) {
  const companyName = input.companyName || "Farrar Apps";
  const name = escapeHtml(input.toName || "there");
  const code = escapeHtml(input.code);
  const newEmail = escapeHtml(input.newEmail);

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
          Enter this code to confirm <strong style="color:#f5f5f5;">${newEmail}</strong> as your new login email:
        </p>
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;letter-spacing:0.35em;font-size:28px;font-weight:700;background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:14px 22px;">
            ${code}
          </div>
        </div>
        <p style="margin:0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          This code expires in 10 minutes. If you didn’t request an email change, you can ignore this message.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = `Hi ${input.toName || "there"},

Enter this code to confirm ${input.newEmail} as your new login email:

${input.code}

It expires in 10 minutes. If you didn't request an email change, ignore this email.`;

  return {
    subject: `${companyName} confirm your new email`,
    htmlContent,
    textContent,
  };
}

export function buildEmailChangedNoticeEmail(input: {
  toName?: string | null;
  oldEmail: string;
  newEmail: string;
  companyName?: string;
}) {
  const companyName = input.companyName || "Farrar Apps";
  const name = escapeHtml(input.toName || "there");
  const newEmail = escapeHtml(input.newEmail);

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
          Your ${escapeHtml(companyName)} login email was changed to
          <strong style="color:#f5f5f5;">${newEmail}</strong>.
        </p>
        <p style="margin:0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          If you didn’t make this change, sign in with the new address (if you still can) or contact support immediately.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = `Hi ${input.toName || "there"},

Your ${companyName} login email was changed to ${input.newEmail}.

If you didn't make this change, contact support immediately.`;

  return {
    subject: `${companyName} login email changed`,
    htmlContent,
    textContent,
  };
}
