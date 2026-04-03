// D4: Cloudflare API helpers for Workers KV landing page deployment
const CF_API = "https://api.cloudflare.com/client/v4";

function cfHeaders(): Record<string, string> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Ensure KV namespace "ZAP_PAGES" exists; return its ID
export async function ensureKvNamespace(): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID not set");

  const listRes = await fetch(`${CF_API}/accounts/${accountId}/storage/kv/namespaces?per_page=100`, {
    headers: cfHeaders(),
  });
  const listData = (await listRes.json()) as any;
  if (listData.success) {
    const existing = listData.result?.find((ns: any) => ns.title === "ZAP_PAGES");
    if (existing) return existing.id as string;
  }

  const createRes = await fetch(`${CF_API}/accounts/${accountId}/storage/kv/namespaces`, {
    method: "POST",
    headers: cfHeaders(),
    body: JSON.stringify({ title: "ZAP_PAGES" }),
  });
  const createData = (await createRes.json()) as any;
  if (!createData.success) throw new Error(`KV create failed: ${JSON.stringify(createData.errors)}`);
  return createData.result.id as string;
}

// Write HTML to KV under slug key
export async function writeKvPage(namespaceId: string, slug: string, html: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(slug)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/html" },
      body: html,
    }
  );
  const data = (await res.json()) as any;
  if (!data.success) throw new Error(`KV write failed: ${JSON.stringify(data.errors)}`);
}

// Deploy or update Workers script with KV binding and zapcampaigns.com/p/* route
export async function deployWorker(namespaceId: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !zoneId || !token) throw new Error("Cloudflare credentials not set");

  const workerScript = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.pathname.replace('/p/', '').replace(/\\/$/, '');
    if (!slug) return new Response('Not found', { status: 404 });
    const html = await env.ZAP_PAGES.get(slug);
    if (!html) return new Response('Page not found', { status: 404 });
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' }
    });
  }
}`;

  const metadata = JSON.stringify({
    main_module: "worker.js",
    bindings: [{ type: "kv_namespace", name: "ZAP_PAGES", namespace_id: namespaceId }],
    compatibility_date: "2024-01-01",
  });

  // FormData with multipart/form-data for Workers upload
  const boundary = "----ZapWorkerBoundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="metadata"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n` +
    `Content-Type: application/javascript+module\r\n\r\n` +
    `${workerScript}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/zap-landing-pages`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const uploadData = (await uploadRes.json()) as any;
  if (!uploadData.success) {
    console.error("[CF Worker] Script upload failed:", JSON.stringify(uploadData.errors));
    // Non-fatal — KV write still works even if worker re-deploy fails
    return;
  }

  // Ensure route zapcampaigns.com/p/* points to this worker
  const routePattern = "zapcampaigns.com/p/*";
  const routesRes = await fetch(`${CF_API}/zones/${zoneId}/workers/routes`, { headers: cfHeaders() });
  const routesData = (await routesRes.json()) as any;
  const routeExists = routesData.result?.some((r: any) => r.pattern === routePattern);
  if (!routeExists) {
    await fetch(`${CF_API}/zones/${zoneId}/workers/routes`, {
      method: "POST",
      headers: cfHeaders(),
      body: JSON.stringify({ pattern: routePattern, script: "zap-landing-pages" }),
    });
  }
}
