import { withHeaders } from "@elysiajs/openapi";
import { t } from "elysia";

const requestIdHeaderSchema = t.Object({
  "x-request-id": t.String({
    description: "Request correlation identifier."
  })
});

export function withRequestIdHeader<T extends import("elysia").TSchema>(schema: T): T;
export function withRequestIdHeader(schema: import("elysia").TSchema) {
  return withHeaders(schema, requestIdHeaderSchema);
}
