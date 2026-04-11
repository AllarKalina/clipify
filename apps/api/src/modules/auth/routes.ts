import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { withHeaders } from "@elysiajs/openapi";
import type { AppAuth } from "./service";
import { withRequestIdHeader } from "../../plugins/openapi-headers";
import { buildRateLimitKey } from "../../plugins/rate-limit-key";

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
const authResponseHeaders = t.Object({
  "x-request-id": t.String({
    description: "Request correlation identifier."
  }),
  "set-cookie": t.Optional(
    t.String({
      description: "Better Auth session cookie."
    })
  )
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

type AuthModuleOptions = {
  trustProxyHeaders?: boolean;
};

export function authModule(auth: AppAuth, options: AuthModuleOptions = {}) {
  return new Elysia({
    name: "auth",
    prefix: "/api/auth",
    tags: ["auth"]
  })
    .use(
      rateLimit({
        scoping: "local",
        duration: 60_000,
        max: 10,
        generator: (request) =>
          buildRateLimitKey(request, {
            scope: "auth",
            trustProxyHeaders: options.trustProxyHeaders
          }),
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
          summary: "Sign in with email and password"
        },
        body: signInBodySchema,
        response: {
          200: withHeaders(signInResponseSchema, authResponseHeaders),
          429: withRequestIdHeader(authRateLimitResponseSchema)
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
          summary: "Sign up with email and password"
        },
        body: signUpBodySchema,
        response: {
          200: withHeaders(signUpResponseSchema, authResponseHeaders),
          429: withRequestIdHeader(authRateLimitResponseSchema)
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
          summary: "Sign out the current user"
        },
        response: {
          200: withHeaders(signOutResponseSchema, authResponseHeaders),
          429: withRequestIdHeader(authRateLimitResponseSchema)
        }
      }
    );
}
