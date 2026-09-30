import { env, requireServerEnv } from "@/lib/env";
import {
  zeptoMailBody,
  type OutgoingEmail,
} from "@/lib/invitations/zeptomail-body";

/** Sends an email through ZeptoMail. Throws if it isn't accepted. */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const response = await fetch(env.ZEPTOMAIL_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Zoho-enczapikey ${requireServerEnv("ZEPTOMAIL_TOKEN")}`,
    },
    body: JSON.stringify(zeptoMailBody(email)),
  });
  if (!response.ok) {
    throw new Error(`ZeptoMail refused the email (${response.status}).`);
  }
}
