import { ZodError } from "zod";
import { DalError } from "@/server/dal/errors";

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function routeErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return jsonError(400, "VALIDATION_ERROR", first?.message ?? "Invalid input.");
  }
  if (error instanceof DalError) {
    return jsonError(error.statusCode, error.code, error.message);
  }
  if (error instanceof SyntaxError) {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  console.error("[api] Unhandled error:", error);
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export async function readJson<T>(request: Request, schema: {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown };
}): Promise<T> {
  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }
  return parsed.data;
}
