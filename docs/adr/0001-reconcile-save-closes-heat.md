# Saving reconciliation closes and publishes the heat

The spec (§4.5) described two steps: an official confirms a heat, and publishing is a separate gate. We merged them. When an official saves a heat's reconciliation, the heat is **Closed**. A closed heat's results are official and published, its capture screens stop accepting captures, and export includes only closed heats. On race day the same official does both steps back to back, so a separate publish step would only add a place to forget one. An official can reopen a heat by giving a reason, which is written to `audit_log`. While a heat is reopened, it is left out of the export until it is saved again.

## Consequences

- A capture that syncs after its heat has closed (from a phone that was offline) is accepted, never rejected, and flagged on the reconcile screen.
- The export shows how many athletes it left out because their heat is not closed.
