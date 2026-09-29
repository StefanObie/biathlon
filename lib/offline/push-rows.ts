// Postgres's "insufficient privilege", which RLS raises for a refused row.
const REFUSED = "42501";

/**
 * Pushes a sync queue's pending rows in one batch and returns the ids that
 * landed. If the database refuses the batch, the rows go again one at a
 * time: a capture its author made after leaving the League team is refused
 * (#36), and it mustn't hold back the ones they made while still on it. A
 * batch that fails for any other reason (offline, say) lands nothing and
 * isn't retried here — the next sweep sends it again.
 */
export async function pushRows<Row extends { id: string }>(
  rows: Row[],
  upsert: (rows: Row[]) => PromiseLike<{ error: { code: string } | null }>,
): Promise<Set<string>> {
  const { error } = await upsert(rows);
  if (!error) return new Set(rows.map((r) => r.id));
  if (error.code !== REFUSED || rows.length === 1) return new Set();

  const landed = new Set<string>();
  for (const row of rows) {
    const { error } = await upsert([row]);
    if (!error) landed.add(row.id);
  }
  return landed;
}
