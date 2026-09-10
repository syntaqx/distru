import { reportRoute } from "../_registry";

export async function GET(req: Request) {
  return reportRoute("order-fulfillment")(req);
}
