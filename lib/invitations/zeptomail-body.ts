export const INVITES_FROM = {
  address: "invites@crossland.co.za",
  name: "Crossland Biathlon",
};

export interface OutgoingEmail {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

/** The ZeptoMail "send email" request body for an email. */
export function zeptoMailBody(email: OutgoingEmail) {
  return {
    from: INVITES_FROM,
    to: [{ email_address: { address: email.to } }],
    reply_to: [{ address: email.replyTo }],
    subject: email.subject,
    htmlbody: email.html,
    textbody: email.text,
  };
}
