/** Synthetic browser-only auth signal, enabled only for chat E2E Vite. No credentials. */
type FixtureSession = { user: { id: string } } | null;
type AuthListener = (event: string, session: FixtureSession) => void;
const listeners = new Set<AuthListener>();
export const createClient = () => ({
  auth: {
    onAuthStateChange(listener: AuthListener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
  },
});
export function emitFixtureAuth(event: string, userId: string | null) {
  for (const listener of listeners) listener(event, userId ? { user: { id: userId } } : null);
}
