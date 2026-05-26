import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function FROM() { return process.env.RESEND_FROM_EMAIL ?? "noreply@liminalsva.com"; }
function APP()  { return process.env.NEXT_PUBLIC_APP_URL ?? "https://liminalsva.com"; }

// ─── 1. Welcome ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: "Welcome to Liminal",
    html: `
      <h1>Welcome, ${name}!</h1>
      <p>Your Liminal account is ready. Start by creating your first certification project.</p>
      <p><a href="${APP()}/dashboard">Go to Dashboard →</a></p>
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
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Upload received — ${creditName}`,
    html: `
      <h1>We received your documents</h1>
      <p>Hi ${name},</p>
      <p>We received <strong>${fileCount} file(s)</strong> for <strong>${creditName}</strong>.</p>
      <p>When you're ready to submit for review, click the button below.</p>
      <p><a href="${APP()}/orders/${orderId}">Review and Submit →</a></p>
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
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Action required — ${creditName}`,
    html: `
      <h1>Additional documents needed</h1>
      <p>Hi ${name},</p>
      <p>We reviewed your submission for <strong>${creditName}</strong> and need the following before we can proceed:</p>
      <ul>${issueList}</ul>
      <p>Please upload the corrected documents and mark your submission as ready again.</p>
      <p><a href="${APP()}/orders/${orderId}/upload">Upload Documents →</a></p>
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
  return getResend().emails.send({
    from:    FROM(),
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
      const filename   = p.split("/").pop() ?? p;
      const isEditable = filename.includes("editable");
      const label      = isEditable
        ? `${filename} <span style="color:#388fa6;font-size:12px;">(editable version)</span>`
        : filename;
      return `<li style="margin-bottom:6px;"><a href="${APP()}/orders/${orderId}/download?path=${encodeURIComponent(p)}">${label}</a></li>`;
    })
    .join("\n");

  return getResend().emails.send({
    from:    FROM(),
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
      <p>Your submitted project documents will be deleted from our servers within 48 hours. Your output files are retained permanently in your dashboard.</p>
      <p><a href="${APP()}/orders/${orderId}/delivery">View Output →</a></p>
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
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Action required — download your ${creditName} files before they expire`,
    html: `
      <h1>Uploaded documents expiring in 48 hours</h1>
      <p>Hi ${name},</p>
      <p>This is a reminder that the project documents you uploaded for <strong>${creditName}</strong> will be automatically deleted from our servers in 48 hours as part of our privacy policy.</p>
      <p>Your output files are not affected and remain available in your dashboard.</p>
      <p><a href="${APP()}/orders/${orderId}/delivery">View Output →</a></p>
    `,
  });
}

// ─── 7. QA review notification (internal) ─────────────────────────────────────

export async function sendQAReviewEmail({
  customerName,
  customerEmail,
  creditName,
  projectName,
  orderId,
  generatedAt,
  deliveryScheduledAt,
  standardHtmlUrl,
  editableHtmlUrl,
  approveUrl,
  requestChangesUrl,
  isRegeneration = false,
  changeInstructions,
}: {
  customerName: string;
  customerEmail: string;
  creditName: string;
  projectName: string;
  orderId: string;
  generatedAt: string;
  deliveryScheduledAt: string;
  standardHtmlUrl: string;
  editableHtmlUrl: string;
  approveUrl: string;
  requestChangesUrl: string;
  isRegeneration?: boolean;
  changeInstructions?: string;
}) {
  const delivery = new Date(deliveryScheduledAt);
  const now      = new Date(generatedAt);
  const msLeft   = delivery.getTime() - now.getTime();
  const hLeft    = Math.floor(msLeft / 3600000);
  const mLeft    = Math.floor((msLeft % 3600000) / 60000);
  const shortId  = orderId.slice(0, 8).toUpperCase();

  const regenerationNote = isRegeneration
    ? `<div style="background:#fff8e1;border-left:3px solid #f5a623;padding:12px 16px;margin-bottom:16px;font-size:14px;">
        <strong>REGENERATED OUTPUT</strong> — Changes were requested and the pipeline has re-run.
        ${changeInstructions ? `<br><br><strong>Instructions applied:</strong><br><pre style="margin:8px 0 0;white-space:pre-wrap;font-size:13px;">${changeInstructions}</pre>` : ""}
       </div>`
    : "";

  return getResend().emails.send({
    from:    FROM(),
    to:      "reviews@liminalsva.com",
    subject: `QA Review Required — ${creditName} — ${projectName} — Order #${shortId}`,
    html: `
      <div style="font-family:sans-serif;max-width:680px;margin:0 auto;">
        <h2 style="margin-bottom:4px;">QA Review Required</h2>
        <p style="color:#666;margin-top:0;">${isRegeneration ? "Regenerated output ready for re-review." : "New output ready for review."}</p>

        ${regenerationNote}

        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px;">
          <tr><td style="padding:6px 12px 6px 0;color:#888;width:140px;">Customer</td><td style="padding:6px 0;">${customerName} &lt;${customerEmail}&gt;</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Credit</td><td style="padding:6px 0;">${creditName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Project</td><td style="padding:6px 0;">${projectName}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Order ID</td><td style="padding:6px 0;font-family:monospace;">${orderId}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Generated</td><td style="padding:6px 0;">${new Date(generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#888;">Auto-delivers</td><td style="padding:6px 0;">${delivery.toLocaleString("en-US", { timeZone: "America/New_York" })} ET <span style="color:#c0392b;font-weight:600;">(${hLeft}h ${mLeft}m remaining)</span></td></tr>
        </table>

        <h3 style="margin-bottom:8px;">Output Files</h3>
        <ul style="padding-left:20px;font-size:14px;line-height:2;">
          <li><a href="${standardHtmlUrl}" style="color:#388fa6;">Standard HTML Output</a> — submission.html</li>
          <li><a href="${editableHtmlUrl}" style="color:#388fa6;">Editable HTML Output</a> — submission-editable.html</li>
        </ul>

        <h3 style="margin-top:24px;margin-bottom:12px;">Actions</h3>
        <table style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:12px;">
              <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#27ae60;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">APPROVE</a>
            </td>
            <td>
              <a href="${requestChangesUrl}" style="display:inline-block;padding:12px 24px;background:#e67e22;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">REQUEST CHANGES</a>
            </td>
          </tr>
        </table>

        <p style="font-size:12px;color:#aaa;margin-top:32px;">
          If no action is taken, output delivers automatically at ${delivery.toLocaleString("en-US", { timeZone: "America/New_York" })} ET.
          If changes were requested and not approved before that time, the customer receives a delay notice.
        </p>
      </div>
    `,
  });
}

// ─── 8. Customer delay notification ───────────────────────────────────────────

export async function sendCustomerDelayEmail({
  to,
  name,
  creditName,
}: {
  to: string;
  name: string;
  creditName: string;
}) {
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Your output for ${creditName} is being reviewed`,
    html: `
      <p>Hi ${name},</p>
      <p>We are completing a final review of your output before delivery. You will receive your files as soon as the review is complete. We apologize for any delay and appreciate your patience.</p>
    `,
  });
}

// ─── 9. Address invalid ───────────────────────────────────────────────────────

export async function sendAddressInvalidEmail({
  to,
  name,
  creditName,
  projectId,
  reason,
}: {
  to:         string;
  name:       string;
  creditName: string;
  projectId:  string;
  reason:     string;
}) {
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Action required — project address needs correction`,
    html: `
      <h1>Your project address could not be verified</h1>
      <p>Hi ${name},</p>
      <p>We were unable to process your <strong>${creditName}</strong> submission because the project address could not be verified:</p>
      <p style="background:#fff8e1;border-left:3px solid #f59e0b;padding:12px 16px;font-size:14px;">${reason}</p>
      <p>Please update your project address and resubmit. No additional charge will apply for this resubmission.</p>
      <p><a href="${APP()}/projects/${projectId}/edit">Update Project Address →</a></p>
      <p style="font-size:12px;color:#888;">If you believe your address is correct, please reply to this email and we will investigate.</p>
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
  return getResend().emails.send({
    from:    FROM(),
    to,
    subject: `${inviterName} invited you to ${projectName} on Liminal`,
    html: `
      <h1>You've been invited</h1>
      <p>${inviterName} has invited you to collaborate on <strong>${projectName}</strong>.</p>
      <a href="${inviteUrl}">Accept Invitation →</a>
    `,
  });
}
