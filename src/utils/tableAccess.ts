import type { GameTable } from '../types/game';

export function tableAccess(
  table: GameTable | null | undefined,
  userId?: string,
) {
  if (!table?.shared) return { canWrite: true, canManage: true };
  const ownSession = !!userId && table.shared.userId === userId;
  const canManage = ownSession && table.shared.ownerId === userId;
  return {
    canManage,
    canWrite: ownSession && (canManage || table.shared.role === 'write'),
  };
}
