import type { AppAuth } from "./service";

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

const protectedSessionCache = new WeakMap<Request, Promise<AuthSession | null>>();

function normalizeSession(session: Awaited<ReturnType<AppAuth["api"]["getSession"]>>): AuthSession | null {
  if (!session?.user) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    }
  };
}

export function cacheProtectedSession(auth: AppAuth, request: Request): Promise<AuthSession | null> {
  const cached = protectedSessionCache.get(request);
  if (cached) {
    return cached;
  }

  const sessionPromise = auth.api.getSession({ headers: request.headers }).then(normalizeSession);
  protectedSessionCache.set(request, sessionPromise);
  return sessionPromise;
}

export async function requireSession(auth: AppAuth, request: Request): Promise<AuthSession> {
  const session = await cacheProtectedSession(auth, request);

  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return session;
}
