import { reportRoute } from "../_registry";

export async function GET(req: Request) {
  return reportRoute("sales-order-item-history")(req);
}
