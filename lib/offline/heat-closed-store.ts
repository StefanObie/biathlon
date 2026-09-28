import Dexie, { type EntityTable } from "dexie";

import type { HeatClosed } from "@/lib/capture/heat-closed";

/** The last closed state this phone saw for a heat, kept so a refresh
 * without a connection still shows a closed heat as closed. It is a cache
 * of league_race, never a source of truth — nothing here is synced back. */
interface StoredHeatClosed extends HeatClosed {
  id: string;
}

function toId(leagueId: number, runHeat: number): string {
  return `${leagueId}:${runHeat}`;
}

class HeatClosedDB extends Dexie {
  heats!: EntityTable<StoredHeatClosed, "id">;

  constructor() {
    super("biathlon-heat-closed");
    this.version(1).stores({ heats: "id" });
  }
}

const db = new HeatClosedDB();

export async function getHeatClosed(
  leagueId: number,
  runHeat: number,
): Promise<HeatClosed | undefined> {
  const row = await db.heats.get(toId(leagueId, runHeat));
  return row && { closedAt: row.closedAt, closedBy: row.closedBy };
}

export async function putHeatClosed(
  leagueId: number,
  runHeat: number,
  closed: HeatClosed,
): Promise<void> {
  await db.heats.put({ id: toId(leagueId, runHeat), ...closed });
}
