# The Invitation link signs the invitee in, with no Sign-in OTP

Sign-in is otherwise passwordless: the Sign-in OTP emailed as a 6-digit code. For Invitations we could have reused it, by auto-accepting the first time the invited email signs in, or by making the invitee enter an OTP after following a link. We chose instead to have the Invitation link sign the invitee in directly and accept the Invitation in one step. Following the link proves control of the email, so it also confirms the address. Inviting people is how Organizations grow, and every extra step on race-day volunteers' phones loses people. The cost is that the link is a bearer credential: anyone who opens it first is signed in as the invitee. We limit that by making the link work once, expire after 7 days, be cancellable by an Admin, and never act when a different user is already signed in. It works for new and existing accounts alike.

The Invitation email is sent through ZeptoMail from `invites@crossland.co.za`, not through Supabase Auth's own email. That means the server holds a service-role key, used only to create the invitee's session from the link, and the auth email rate limit does not apply.

The link's GET request only loads a landing page, which then posts to accept. Mail scanners that open links ahead of the human therefore cannot use the link up.

## Consequences

- Sign-in OTP remains the only way to sign in without an Invitation link. If more login options arrive later, the Invitation link should be revisited alongside them.
- A forwarded link gives its first opener the invitee's account, and only the Admin cancelling it beforehand prevents that.
- The app needs a server-only `SUPABASE_SERVICE_ROLE_KEY` and ZeptoMail credentials, which the repo did not have before.
