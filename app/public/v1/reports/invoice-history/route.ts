import { reportRoute } from "../_registry";

export async function GET(req: Request) {
  return reportRoute("invoice-history")(req);
}
