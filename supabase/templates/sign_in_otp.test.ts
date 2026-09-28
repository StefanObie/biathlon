import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const supabaseDir = path.resolve(__dirname, "..");
const config = readFileSync(path.join(supabaseDir, "config.toml"), "utf8");
const template = readFileSync(
  path.join(supabaseDir, "templates", "sign_in_otp.html"),
  "utf8",
);

/** The key/value lines of one `[section]` in config.toml. */
function section(name: string): Record<string, string> {
  const lines = config.split("\n");
  const start = lines.indexOf(`[${name}]`);
  if (start === -1) return {};
  const entries: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("[")) break;
    const match = line.match(/^(\w+)\s*=\s*"(.*)"$/);
    if (match) entries[match[1]] = match[2];
  }
  return entries;
}

describe("Sign-in OTP email", () => {
  // GoTrue sends `confirmation` to a new user when "Confirm email" is on and
  // `magic_link` otherwise, so both must be the same email.
  it.each(["magic_link", "confirmation"])("is the %s template", (template) => {
    expect(section(`auth.email.template.${template}`)).toEqual({
      subject: "Your sign-in OTP",
      content_path: "./supabase/templates/sign_in_otp.html",
    });
  });

  it("shows the OTP once, as its own unbroken text", () => {
    expect(template.match(/\{\{\s*\.Token\s*\}\}/g)).toHaveLength(1);
    expect(template).toMatch(/>\s*\{\{ \.Token \}\}\s*</);
  });

  it("has no sign-in link", () => {
    expect(template).not.toMatch(/ConfirmationURL|TokenHash|<a\s/i);
  });
});
