import { describe, expect, it } from "vitest";

import { invitationEmail } from "./email";

const base = {
  organizationName: "Gauteng North",
  inviterEmail: "admin@example.com",
  link: "https://app.test/auth/invitation?token=abc",
  expiresAt: new Date("2026-10-07T10:00:00Z"),
  roleText: null,
};

describe("invitationEmail", () => {
  it("names the Organization and carries the link in both bodies", () => {
    const email = invitationEmail(base);
    expect(email.subject).toBe("You're invited to join Gauteng North");
    expect(email.html).toContain(base.link);
    expect(email.text).toContain(base.link);
    expect(email.text).toContain("7 October 2026");
  });

  it("mentions the Role when there is one", () => {
    const email = invitationEmail({
      ...base,
      roleText: "a Caller on League A",
    });
    expect(email.text).toContain("as a Caller on League A");
    expect(email.html).toContain("as a Caller on League A");
  });

  it("escapes markup in names", () => {
    const email = invitationEmail({
      ...base,
      organizationName: "<script>x</script> & Co",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;x&lt;/script&gt; &amp; Co");
  });
});
