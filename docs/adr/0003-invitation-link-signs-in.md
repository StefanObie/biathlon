# The Invitation link signs a new invitee in, with no Sign-in OTP

Sign-in is otherwise passwordless: the Sign-in OTP emailed as a 6-digit code. For Invitations we could have reused it, by auto-accepting the first time the invited email signs in, or by making the invitee enter an OTP after following a link. We chose instead to have the Invitation link sign the invitee in directly and accept the Invitation in one step. Following the link proves control of the email, so it also confirms the address. Inviting people is how Organizations grow, and every extra step on race-day volunteers' phones loses people. The cost is that the link is a bearer credential: anyone who opens it first is signed in as the invitee. We limit that by making the link work once, expire after 7 days, be cancellable by an Admin, and never act when a different user is already signed in.

The Invitation email is sent through ZeptoMail from `invites@crossland.co.za`, not through Supabase Auth's own email. That means the server holds a service-role key, used only for Invitations, and the auth email rate limit does not apply. It creates the invitee's session from the link, and it is also the only way to send an Invitation (see below).

Because the link signs in as the invited email, whoever picks its secret can sign in as the invitee. So only the server may send an Invitation: it makes the secret, emails it and stores only its hash, through `send_invitation`, which the browser cannot call. The server passes in the signed-in user as the inviter, and the database checks that they are an Admin. An earlier version let the browser call `send_invitation` with a hash of its own choosing, which let any Admin of any Organization sign in as anyone they invited.

The link's GET request only loads a landing page, which then posts to accept. Mail scanners that open links ahead of the human therefore cannot use the link up.

## Narrowed: only an account that has never signed in

We first let the link sign in any account, new or existing. That made a leaked or forwarded link hand over an account with Organizations and data of its own, not just a fresh one. So we partly reversed the decision above: the link now signs in only an account that has never signed in, which is every invitee new to the app. An account that has signed in before is sent to sign in with a Sign-in OTP, then back to the link, which accepts the Invitation for them as the signed-in invitee. We judge by whether the account has ever signed in, not by when it was made, because an account made after the Invitation was sent (by signing up, or by another Invitation's link) may already hold data.

## Consequences

- Sign-in OTP remains the only way to sign in without an Invitation link. If more login options arrive later, the Invitation link should be revisited alongside them.
- A forwarded link gives its first opener the invitee's account if that account has never signed in, and only the Admin cancelling it beforehand prevents that. An account that has signed in is never signed in by the link alone.
- Existing users take one extra step (the Sign-in OTP) to accept an Invitation.
- Telling the two apart uses the account `generateLink` returns, so following the link makes a sign-in token for an existing account too, which can replace a Sign-in OTP waiting in their inbox. Someone holding the link could keep doing that to get in the invitee's way, though never to sign in as them.
- Nothing outside the server may write an Invitation's secret. Any new way to create or re-send an Invitation must go through the server too.
- The app needs a server-only `INVITE_MEMBERS_EMAIL_SECRET_KEY` (a dedicated Supabase secret key, not the default service-role key) and ZeptoMail credentials, which the repo did not have before.
