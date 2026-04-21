import { Hono } from "hono/tiny";
import { authRequired } from "../rpc/auth.js";

type ConduitStub = {
	fetch: (request: Request) => Promise<Response>;
};

/**
 * Create a Hono router that handles WebSocket upgrades for the conduit.
 *
 * Mount this at `/api/conduit` (or wherever your `wrangler.jsonc` routes it).
 */
export function createConduitRoute(getDurableConduit: (userId: string) => Promise<ConduitStub>): Hono {
	const router = new Hono();

	router.get("/ws", async (c) => {
		const { user } = await authRequired();
		const conduit = await getDurableConduit(user.id);
		return conduit.fetch(c.req.raw);
	});

	return router;
}
