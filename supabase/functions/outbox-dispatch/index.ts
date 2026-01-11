import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async () => {
  const jobUrl = Deno.env.get("OUTBOX_JOB_URL");
  const token = Deno.env.get("CRON_SECRET") || Deno.env.get("OUTBOX_JOB_TOKEN");

  if (!jobUrl || !token) {
    return new Response("Missing OUTBOX_JOB_URL/CRON_SECRET", { status: 500 });
  }

  const response = await fetch(jobUrl, {
    method: "POST",
    headers: {
      "x-job-token": token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ source: "supabase-edge" }),
  });

  if (!response.ok) {
    const text = await response.text();
    return new Response(text || "Job failed", { status: response.status });
  }

  return new Response("ok", { status: 200 });
});
