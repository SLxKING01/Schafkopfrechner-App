import * as crypto from 'expo-crypto';

import type { CreateTablePayload, GameTable } from '../../types/game';

const TABLE_CODE_PREFIXES = ['SKF', 'TBL', 'SCH'] as const;
const TABLE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TABLE_CODE_LENGTH = 4;

export function generateTableHashCode(existingCodes: string[] = []) {
  const usedCodes = new Set(existingCodes.map((code) => code.toUpperCase()));

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createReadableTableCode();

    if (!usedCodes.has(code)) {
      return code;
    }
  }

  return createReadableTableCode();
}

export function createGameTable(payload: CreateTablePayload): GameTable {
  // TODO: persist table in Supabase when multiplayer sync is introduced.
  return {
    id: crypto.randomUUID(),
    hashCode: generateTableHashCode(payload.existingHashCodes),
    name: payload.name.trim(),
    createdAt: new Date().toISOString(),
    isActive: true,
  };
}

function createReadableTableCode() {
  const randomSeed = crypto.randomUUID().replace(/-/g, '');
  const prefix =
    TABLE_CODE_PREFIXES[
      getSeededIndex(randomSeed, 0, TABLE_CODE_PREFIXES.length)
    ];
  const suffix = Array.from({ length: TABLE_CODE_LENGTH }, (_, index) =>
    TABLE_CODE_ALPHABET.charAt(
      getSeededIndex(randomSeed, index + 1, TABLE_CODE_ALPHABET.length),
    ),
  ).join('');

  return `${prefix}-${suffix}`;
}

function getSeededIndex(seed: string, index: number, length: number) {
  const offset = index * 2;
  const hexPair = seed.slice(offset, offset + 2) || seed.slice(0, 2);
  const numericSeed = Number.parseInt(hexPair, 16);

  if (Number.isNaN(numericSeed)) {
    return (
      Array.from(hexPair).reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
      ) % length
    );
  }

  return numericSeed % length;
}
