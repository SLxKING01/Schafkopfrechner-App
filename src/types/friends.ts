import type { ProfileCard } from './profile';

export type FriendAction =
  | 'send'
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'remove'
  | 'block'
  | 'unblock';
export type FriendRelation = 'none' | 'incoming' | 'outgoing' | 'friend';
export type FriendEntry = {
  profile: ProfileCard;
  pairVersion: number;
  requestId: string | null;
  blockId: string | null;
};
export type FriendsState = {
  userId: string;
  version: number;
  code: string;
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  blocked: FriendEntry[];
};
export type FriendSearch = {
  userId: string;
  status: 'found' | 'not_found' | 'invalid' | 'self';
  relation: FriendRelation | null;
  entry: FriendEntry | null;
};
export type FriendCommand = {
  action: FriendAction;
  targetId: string;
  expectedVersion: number;
  referenceId: string | null;
  code: string | null;
  operationId: string;
};
