export type RateLimitScope = "auth" | "search";

type RateLimitKeyOptions = {
  scope: RateLimitScope;
  trustProxyHeaders?: boolean;
  allowSessionCookie?: boolean;
};

function readFirstForwardedIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) {
    return null;
  }

  const [first] = forwardedFor.split(",");
  const candidate = first?.trim();
  return candidate ? candidate : null;
}

function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rest] = entry.split("=");
    if (!rawName || rest.length === 0) {
      continue;
    }

    if (rawName.trim() !== "better-auth.session_token") {
      continue;
    }

    const token = rest.join("=").trim();
    if (!token) {
      return null;
    }

    return token;
  }

  return null;
}

function readProxyIp(request: Request): string | null {
  return (
    readFirstForwardedIp(request.headers.get("x-forwarded-for")) ??
    request.headers.get("cf-connecting-ip")?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    null
  );
}

export function buildRateLimitKey(request: Request, options: RateLimitKeyOptions): string {
  const { scope, trustProxyHeaders = false, allowSessionCookie = false } = options;

  if (allowSessionCookie) {
    const sessionToken = readSessionToken(request.headers.get("cookie"));
    if (sessionToken) {
      return `${scope}:session:${Bun.hash(sessionToken).toString(16)}`;
    }
  }

  if (trustProxyHeaders) {
    const proxyIp = readProxyIp(request);
    if (proxyIp) {
      return `${scope}:ip:${proxyIp}`;
    }
  }

  return `${scope}:global:${new URL(request.url).hostname}`;
}
