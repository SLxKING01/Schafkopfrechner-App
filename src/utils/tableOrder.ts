const MAX_TABLE_ORDER_IDS = 100;

export function sanitizeTableOrderIds(
  value: unknown,
  allowedIds?: readonly string[],
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedIdSet = allowedIds ? new Set(allowedIds) : null;
  const seenIds = new Set<string>();
  const sanitizedIds: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const tableId = item.trim();

    if (
      !tableId ||
      seenIds.has(tableId) ||
      (allowedIdSet && !allowedIdSet.has(tableId))
    ) {
      continue;
    }

    seenIds.add(tableId);
    sanitizedIds.push(tableId);

    if (sanitizedIds.length >= MAX_TABLE_ORDER_IDS) {
      break;
    }
  }

  return sanitizedIds;
}

export function areTableOrderIdsEqual(
  firstIds: readonly string[],
  secondIds: readonly string[],
) {
  return (
    firstIds.length === secondIds.length &&
    firstIds.every((tableId, index) => tableId === secondIds[index])
  );
}
