import { reportRoute } from "../_registry";

export async function GET(req: Request) {
  return reportRoute("purchases-by-company")(req);
}
