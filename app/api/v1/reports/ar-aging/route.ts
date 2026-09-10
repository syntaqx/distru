import { reportRoute } from "../_registry";

export async function GET(req: Request) {
  return reportRoute("ar-aging")(req);
}
