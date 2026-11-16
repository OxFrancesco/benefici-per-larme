import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getDashboard, startRun } from "../functions.ts";

export const Route = createFileRoute("/")({ loader: () => getDashboard(), component: Home });

function Home() {
  const { benefits, runs, events } = Route.useLoaderData();
  const router = useRouter();
  return (
    <main className="p-8">
      <button type="button" onClick={() => startRun().then(() => router.invalidate())}>
        Avvia ricerca
      </button>
      <pre>{JSON.stringify({ runs, events, benefits }, null, 2)}</pre>
    </main>
  );
}
