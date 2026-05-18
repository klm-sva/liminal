import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@liminalsva.com";
const APP   = process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com";

// ─── 1. Welcome ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  return resend.emails.send({
    from:    FROM,
    to,
    subject: "Welcome to Liminal",
    html: `
      <h1>Welcome, ${name}!</h1>
      <p>Your Liminal account is ready. Start by creating your first certification project.</p>
      <p><a href="${APP}/dashboard">Go to Dashboard →</a></p>
    `,
  });
}

// ─── 2. Upload confirmation ───────────────────────────────────────────────────

export async function sendUploadConfirmationEmail({
  to,
  name,
  creditName,
  orderId,
  fileCount,
}: {
  to: string;
  name: string;
  creditName: string;
  orderId: string;
  fileCount: number;
}) {
  return resend.emails.send({
    from:    FROM,
    to,
    subject: `Upload received — ${creditName}`,
    html: `
      <h1>We received your documents</h1>
      <p>Hi ${name},</p>
      <p>We received <strong>${fileCount} file(s)</strong> for <strong>${creditName}</strong>.</p>
      <p>When you're ready to submit for review, click the button below.</p>
      <p><a href="${APP}/orders/${orderId}">Review and Submit →</a></p>
    `,
  });
}

// ─── 3. Documents requested (review incomplete) ───────────────────────────────

export async function sendDocumentsRequestedEmail({
  to,
  name,
  creditName,
  orderId,
  issues,
}: {
  to: string;
  name: string;
  creditName: string;
  orderId: string;
  issues: string[];
}) {
  const issueList = issues.map((i) => `<li>${i}</li>`).join("\n");
  return resend.emails.send({
    from:    FROM,
    to,
    subject: `Action required — ${creditName}`,
    html: `
      <h1>Additional documents needed</h1>
      <p>Hi ${name},</p>
      <p>We reviewed your submission for <strong>${creditName}</strong> and need the following before we can proceed:</p>
      <ul>${issueList}</ul>
      <p>Please upload the corrected documents and mark your submission as ready again.</p>
      <p><a href="${APP}/orders/${orderId}">Upload Documents →</a></p>
    `,
  });
}

// ─── 4. Processing started ────────────────────────────────────────────────────

export async function sendProcessingStartedEmail({
  to,
  name,
  creditName,
}: {
  to: string;
  name: string;
  creditName: string;
}) {
  return resend.emails.send({
    from:    FROM,
    to,
    subject: `Processing your submission — ${creditName}`,
    html: `
      <h1>Your submission is being processed</h1>
      <p>Hi ${name},</p>
      <p>All documents checked out. We are now generating your <strong>${creditName}</strong> submission package.</p>
      <p>You'll receive an email with download links when it's ready — typically within a few minutes.</p>
    `,
  });
}

// ─── 5. Output delivery ───────────────────────────────────────────────────────

export async function sendOutputDeliveryEmail({
  to,
  name,
  creditName,
  orderId,
  outputPaths,
}: {
  to: string;
  name: string;
  creditName: string;
  orderId: string;
  outputPaths: string[];
}) {
  const links = outputPaths
    .map((p) => {
      const filename  = p.split("/").pop() ?? p;
      const isEditable = filename.includes("editable");
      const label     = isEditable
        ? `${filename} <span style="color:#388fa6;font-size:12px;">(editable version)</span>`
        : filename;
      return `<li style="margin-bottom:6px;"><a href="${APP}/orders/${orderId}/download?path=${encodeURIComponent(p)}">${label}</a></li>`;
    })
    .join("\n");

  return resend.emails.send({
    from:    FROM,
    to,
    subject: `Your ${creditName} submission is ready`,
    html: `
      <h1>Your submission package is ready</h1>
      <p>Hi ${name},</p>
      <p>Your <strong>${creditName}</strong> submission documents are ready for download:</p>
      <ul>${links}</ul>
      <p style="background:#f5f5f5;padding:12px 16px;border-left:3px solid #327cb9;font-size:14px;">
        Your output is delivered as editable files. Open either in any browser.
        Use the <strong>editable version</strong> to make changes directly in your browser,
        then save as a PDF using <strong>File &rarr; Print &rarr; Save as PDF</strong>.
      </p>
      <p><strong>Important:</strong> These files will be automatically deleted in 48 hours. Please download and save them now.</p>
      <p><a href="${APP}/orders/${orderId}">View Order →</a></p>
    `,
  });
}

// ─── 6. 48-hour deletion warning ─────────────────────────────────────────────

export async function sendDeletionWarningEmail({
  to,
  name,
  creditName,
  orderId,
}: {
  to: string;
  name: string;
  creditName: string;
  orderId: string;
}) {
  return resend.emails.send({
    from:    FROM,
    to,
    subject: `Action required — download your ${creditName} files before they expire`,
    html: `
      <h1>Your files expire in 48 hours</h1>
      <p>Hi ${name},</p>
      <p>The files for your <strong>${creditName}</strong> order will be permanently deleted in 48 hours as part of our privacy policy.</p>
      <p>Please download your submission documents before they expire.</p>
      <p><a href="${APP}/orders/${orderId}">Download Files →</a></p>
    `,
  });
}

// ─── Legacy emails (kept for compatibility) ───────────────────────────────────

export async function sendProjectInviteEmail({
  to,
  inviterName,
  projectName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  projectName: string;
  inviteUrl: string;
}) {
  return resend.emails.send({
    from:    FROM,
    to,
    subject: `${inviterName} invited you to ${projectName} on Liminal`,
    html: `
      <h1>You've been invited</h1>
      <p>${inviterName} has invited you to collaborate on <strong>${projectName}</strong>.</p>
      <a href="${inviteUrl}">Accept Invitation →</a>
    `,
  });
}
