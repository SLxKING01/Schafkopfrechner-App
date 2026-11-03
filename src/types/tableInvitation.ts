import type { ProfileCard } from './profile';

export type TableInvitation = {
  id: string;
  tableId: string;
  tableName: string;
  playerId: string;
  playerName: string;
  sender: ProfileCard;
  recipient: ProfileCard;
  role: 'read' | 'write';
  createdAt: string;
  expiresAt: string;
  available: boolean;
};
export type InvitationState = {
  userId: string;
  invitations: TableInvitation[];
};
export type InvitationCommand = {
  action: 'send' | 'accept' | 'decline' | 'cancel';
  id: string;
  tableId?: string;
  recipientId?: string;
  playerId?: string;
  role?: 'read' | 'write';
  version?: number;
};
