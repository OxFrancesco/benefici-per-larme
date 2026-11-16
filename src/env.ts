import * as cf from "cloudflare:workers";
import type { WebsiteEnv } from "../alchemy.run.ts";

// `import { env } from "cloudflare:workers"` is not ready at module top level under TanStack Start's dev server,
// so bindings are read through a proxy at call time.
export const env = new Proxy({} as WebsiteEnv, {
  get: (_, prop) => cf.env[prop as keyof typeof cf.env],
});
