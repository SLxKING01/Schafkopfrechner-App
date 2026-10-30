import type { ReactNode } from 'react';

/** Native builds keep their normal full-screen root. */
export function AppViewport({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
