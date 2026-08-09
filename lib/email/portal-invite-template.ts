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
  /** New signup invite vs reminder for an existing linked account. */
  mode?: "invite" | "access";
}) {
  const companyName = input.companyName || "Farrar Apps";
  const name = escapeHtml(input.customer.name);
  const email = escapeHtml(input.customer.email || "");
  const mode = input.mode ?? "invite";
  const isAccess = mode === "access";

  const headline = isAccess
    ? `Sign in to the ${escapeHtml(companyName)} client portal`
    : `You’ve been invited to the ${escapeHtml(companyName)} client portal`;
  const body = isAccess
    ? `Your account for <strong>${email}</strong> is ready. Click below to sign in and open the portal to view invoices, project status, and submit briefs.`
    : `Click below to create your password for <strong>${email}</strong>, then you’ll land right in the portal to view invoices, project status, and submit briefs.`;
  const cta = isAccess ? "Sign in to portal" : "Set password &amp; open portal";
  const footer = isAccess
    ? "If you did not expect this message, you can ignore it."
    : "This invite is tied to your email address and expires in 14 days. If you did not expect it, you can ignore this message.";

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
          ${headline}. ${body}
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#f5f5f5;color:#0b0b0b;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:13px;">
            ${cta}
          </a>
        </div>
        <p style="margin:0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          ${footer}
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = [
    `Hi ${input.customer.name},`,
    "",
    isAccess
      ? `Sign in to the ${companyName} client portal with ${input.customer.email}.`
      : `You've been invited to the ${companyName} client portal.`,
    isAccess
      ? "Use the link below to open the portal."
      : `Create your password for ${input.customer.email}, then you'll open the portal directly.`,
    "",
    `${isAccess ? "Sign in to portal" : "Set password & open portal"}: ${input.loginUrl}`,
    "",
    isAccess
      ? "If you did not expect this message, you can ignore it."
      : "This invite expires in 14 days. If you did not expect it, you can ignore this message.",
  ].join("\n");

  return { htmlContent, textContent };
}
