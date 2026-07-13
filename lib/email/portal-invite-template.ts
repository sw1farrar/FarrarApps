import type { Customer } from "@/lib/types/database";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildPortalInviteEmail(input: {
  customer: Customer;
  loginUrl: string;
  companyName?: string;
}) {
  const companyName = input.companyName || "Farrar Apps";
  const name = escapeHtml(input.customer.name);
  const email = escapeHtml(input.customer.email || "");

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
          You’ve been invited to the ${escapeHtml(companyName)} client portal. Sign in with
          <strong>${email}</strong> to view invoices, project status, and submit new briefs.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#f5f5f5;color:#0b0b0b;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:13px;">
            Open client portal
          </a>
        </div>
        <p style="margin:0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          If you don’t have an account yet, create one with this same email address on the sign-in page.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = [
    `Hi ${input.customer.name},`,
    "",
    `You've been invited to the ${companyName} client portal.`,
    `Sign in with ${input.customer.email} to view invoices and projects.`,
    "",
    `Open portal: ${input.loginUrl}`,
    "",
    "If you don't have an account yet, create one with this same email address.",
  ].join("\n");

  return { htmlContent, textContent };
}
