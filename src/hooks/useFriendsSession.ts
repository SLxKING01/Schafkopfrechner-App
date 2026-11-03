import { useEffect } from 'react';

import { useAuthStore } from '../store/authStore';
import { resetFriendsSession } from '../store/friendsStore';

export function useFriendsSession() {
  const actor = useAuthStore((state) => state.user?.id);
  useEffect(() => {
    resetFriendsSession(actor);
    return () => resetFriendsSession();
  }, [actor]);
}
