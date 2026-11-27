import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok", app: APP_NAME });
}
