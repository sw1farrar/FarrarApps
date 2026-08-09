type EmailAttachment = {
  name: string;
  content: string;
};

type SendTransactionalEmailInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: EmailAttachment[];
};

export async function sendBrevoEmail(
  input: SendTransactionalEmailInput
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Farrar Apps";

  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY is not configured" };
  }
  if (!senderEmail) {
    return { ok: false, error: "BREVO_SENDER_EMAIL is not configured" };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [
        {
          email: input.toEmail,
          name: input.toName || undefined,
        },
      ],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      attachment: input.attachments,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      error: `Brevo error (${response.status}): ${body || response.statusText}`,
    };
  }

  const data = (await response.json().catch(() => ({}))) as {
    messageId?: string;
  };
  return { ok: true, messageId: data.messageId };
}
