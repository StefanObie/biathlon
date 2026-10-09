# One Google service account reads every Organization's Swim folder

Swim import fetches the Swim results file from Google Drive. To read a folder, the app needs Google credentials, and every Organization either brings its own or shares one. We chose one app-wide service account, `swim-reader@biathlon-swim-importer.iam.gserviceaccount.com`, with its key held server-side. Each Organization shares its Swim folder with that email, and an Admin registers the folder's link in Organization settings. That keeps setup to one share and one paste, with no Google Cloud project per Organization. Today there is a single Organization, and race-day volunteers are not going to manage credentials.

The cost is that the service account can read every folder any Organization has shared with it. The only thing tying a folder to an Organization is the link the Admin registered. An Admin who learns another Organization's folder link could register it and read that Organization's swims. Folder links are unguessable but are passed around, so we accept this for now and narrow it: no two Organizations can register the same Swim folder.

## Consequences

- The app needs a server-only service account key, which the repo did not have before.
- The unique Swim folder rule does not stop an Admin from registering another Organization's subfolder, or a folder that Organization has not registered yet.
- Moving to per-Organization credentials closes the gap. It should happen before Organizations that don't trust each other share the app.
