import type { AppAuth } from "./service";

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export async function requireSession(auth: AppAuth, request: Request): Promise<AuthSession> {
  const session = (await auth.api.getSession({ headers: request.headers })) as AuthSession | null;

  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return session;
}
