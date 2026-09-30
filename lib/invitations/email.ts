export interface InvitationEmailInput {
  organizationName: string;
  inviterEmail: string;
  link: string;
  expiresAt: Date;
  /** e.g. "a Caller on League A"; null when the Invitation names no Role. */
  roleText: string | null;
}

export interface InvitationEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The Invitation email: one button that signs the invitee in. */
export function invitationEmail(input: InvitationEmailInput): InvitationEmail {
  const { organizationName, inviterEmail, link, expiresAt, roleText } = input;
  const expires = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const role = roleText ? ` as ${roleText}` : "";
  const intro = `${inviterEmail} has invited you to join ${organizationName}${role}.`;

  return {
    subject: `You're invited to join ${organizationName}`,
    text: [
      intro,
      "",
      `Open this link to accept and sign in (it works once, and expires on ${expires}):`,
      link,
      "",
      "If you weren't expecting this, you can ignore this email. Don't forward it: whoever opens the link first is signed in as you.",
    ].join("\n"),
    html: `<div style="font-family: sans-serif; max-width: 480px">
<p>${escapeHtml(inviterEmail)} has invited you to join <strong>${escapeHtml(organizationName)}</strong>${escapeHtml(role)}.</p>
<p><a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; border-radius: 6px; text-decoration: none">Accept invitation</a></p>
<p style="color: #555; font-size: 14px">The link works once and expires on ${expires}. If you weren't expecting this, you can ignore this email. Don't forward it: whoever opens the link first is signed in as you.</p>
</div>`,
  };
}
