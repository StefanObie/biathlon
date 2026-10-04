/** The cookie that remembers the last Organization the user visited. */
export const ORGANIZATION_COOKIE = "organization";

/** The remembered Organization id from the cookie's value, or null if there isn't a usable one. */
export function rememberedOrganizationId(
  value: string | undefined,
): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Where bare `/organizations` and `/leagues` land: the remembered
 * Organization if the user is still a Member of it, otherwise their only
 * Organization, otherwise the picker.
 */
export function resolveLanding(
  organizationIds: number[],
  remembered: number | null,
): number | "picker" {
  if (remembered !== null && organizationIds.includes(remembered)) {
    return remembered;
  }
  return organizationIds.length === 1 ? organizationIds[0] : "picker";
}
