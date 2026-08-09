import type { UserRole } from "@/lib/types/database";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function roleLabel(role: UserRole) {
  if (role === "owner") return "an owner";
  if (role === "client") return "a client";
  return "a staff member";
}

export function buildStaffInviteEmail(input: {
  email: string;
  fullName?: string | null;
  role?: UserRole;
  loginUrl: string;
  companyName?: string;
}) {
  const companyName = input.companyName || "Farrar Apps";
  const name = escapeHtml(input.fullName || input.email);
  const email = escapeHtml(input.email);
  const role = input.role || "staff";
  const asRole = roleLabel(role);

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
          You have been invited to join ${escapeHtml(companyName)} as ${asRole}.
          Sign in with <strong>${email}</strong> and set your password to finish setup.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#f5f5f5;color:#0b0b0b;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:13px;">
            Accept invite
          </a>
        </div>
        <p style="margin:0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          This invite is tied to your email address and expires soon. If you did not expect it,
          you can ignore this message.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = [
    `Hi ${input.fullName || input.email},`,
    "",
    `You've been invited to join ${companyName} as ${asRole}.`,
    `Sign in with ${input.email} and set your password to finish setup.`,
    "",
    `Accept invite: ${input.loginUrl}`,
    "",
    "If you did not expect this invite, you can ignore this message.",
  ].join("\n");

  return { htmlContent, textContent };
}
