import { describe, expect, it } from "vitest";

import { zeptoMailBody } from "./zeptomail-body";

describe("zeptoMailBody", () => {
  it("sends from invites@crossland.co.za, Reply-To the Admin", () => {
    const body = zeptoMailBody({
      to: "invitee@example.com",
      replyTo: "admin@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(body.from.address).toBe("invites@crossland.co.za");
    expect(body.reply_to).toEqual([{ address: "admin@example.com" }]);
    expect(body.to).toEqual([
      { email_address: { address: "invitee@example.com" } },
    ]);
    expect(body.htmlbody).toBe("<p>Hi</p>");
  });
});
