import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import type { AppAuth } from "./service";

const authUserSchema = t.Object(
  {
    id: t.String(),
    email: t.String(),
    name: t.String(),
    emailVerified: t.Boolean(),
    createdAt: t.Union([t.String(), t.Date()]),
    updatedAt: t.Union([t.String(), t.Date()]),
    image: t.Optional(t.Nullable(t.String()))
  },
  {
    additionalProperties: true
  }
);

const signInBodySchema = t.Object({
  email: t.String(),
  password: t.String(),
  callbackURL: t.Optional(t.String()),
  rememberMe: t.Optional(t.Boolean())
});

const signUpBodySchema = t.Object(
  {
    name: t.String(),
    email: t.String(),
    password: t.String(),
    image: t.Optional(t.String()),
    callbackURL: t.Optional(t.String()),
    rememberMe: t.Optional(t.Boolean())
  },
  {
    additionalProperties: true
  }
);

const signInResponseSchema = t.Object(
  {
    redirect: t.Boolean(),
    token: t.String(),
    url: t.Optional(t.String()),
    user: authUserSchema
  },
  {
    additionalProperties: true
  }
);

const signUpResponseSchema = t.Object(
  {
    token: t.Nullable(t.String()),
    user: authUserSchema
  },
  {
    additionalProperties: true
  }
);

const signOutResponseSchema = t.Object({
  success: t.Boolean()
});

const authRateLimitResponseSchema = t.Object({
  error: t.Object({
    code: t.Literal("RATE_LIMITED"),
    message: t.String()
  })
});

type MutableSet = {
  headers: Record<string, string | number>;
  status?: number | string;
};

function applyResponseHeaders(
  set: MutableSet,
  headers: Headers | null | undefined,
  status?: number
) {
  if (status) {
    set.status = status;
  }

  if (!headers) {
    return;
  }

  headers.forEach((value, key) => {
    set.headers[key] = value;
  });
}

export function authModule(auth: AppAuth) {
  return new Elysia({ name: "auth", prefix: "/api/auth" })
    .use(
      rateLimit({
        scoping: "local",
        duration: 60_000,
        max: 10,
        generator: (request) =>
          request.headers.get("x-forwarded-for") ??
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-real-ip") ??
          new URL(request.url).hostname,
        responseCode: 429,
        responseMessage: {
          error: {
            code: "RATE_LIMITED",
            message: "Too many authentication requests. Please wait and try again."
          }
        }
      })
    )
    .post(
      "/sign-in/email",
      async ({
        body,
        request,
        set
      }: {
        body: {
          email: string;
          password: string;
          callbackURL?: string;
          rememberMe?: boolean;
        };
        request: Request;
        set: MutableSet;
      }) => {
        const result = await auth.api.signInEmail({
          body,
          headers: request.headers,
          returnHeaders: true,
          returnStatus: true
        });

        applyResponseHeaders(set, result.headers, result.status);
        return result.response;
      },
      {
        detail: {
          tags: ["auth"],
          summary: "Sign in with email and password"
        },
        body: signInBodySchema,
        response: {
          200: signInResponseSchema,
          429: authRateLimitResponseSchema
        }
      }
    )
    .post(
      "/sign-up/email",
      async ({
        body,
        request,
        set
      }: {
        body: {
          name: string;
          email: string;
          password: string;
          image?: string;
          callbackURL?: string;
          rememberMe?: boolean;
        };
        request: Request;
        set: MutableSet;
      }) => {
        const result = await auth.api.signUpEmail({
          body,
          headers: request.headers,
          returnHeaders: true,
          returnStatus: true
        });

        applyResponseHeaders(set, result.headers, result.status);
        return result.response;
      },
      {
        detail: {
          tags: ["auth"],
          summary: "Sign up with email and password"
        },
        body: signUpBodySchema,
        response: {
          200: signUpResponseSchema,
          429: authRateLimitResponseSchema
        }
      }
    )
    .post(
      "/sign-out",
      async ({
        request,
        set
      }: {
        request: Request;
        set: MutableSet;
      }) => {
        const result = await auth.api.signOut({
          headers: request.headers,
          returnHeaders: true,
          returnStatus: true
        });

        applyResponseHeaders(set, result.headers, result.status);
        return result.response;
      },
      {
        detail: {
          tags: ["auth"],
          summary: "Sign out the current user"
        },
        response: {
          200: signOutResponseSchema,
          429: authRateLimitResponseSchema
        }
      }
    );
}
