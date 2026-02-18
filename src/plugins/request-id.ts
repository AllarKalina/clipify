import { Elysia } from "elysia";

function nextRequestId(): string {
  return crypto.randomUUID();
}

export const requestIdPlugin = new Elysia({ name: "request-id" }).onRequest(({ request, set }) => {
  const forwardedRequestId = request.headers.get("x-request-id");
  set.headers["x-request-id"] = forwardedRequestId || nextRequestId();
});
