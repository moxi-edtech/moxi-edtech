import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async () => {
  // Configurado via: supabase secrets set SUBSCRIPTION_REMINDERS_JOB_URL="..."
  const jobUrl = Deno.env.get("SUBSCRIPTION_REMINDERS_JOB_URL");
  const token = Deno.env.get("CRON_SECRET");

  if (!jobUrl || !token) {
    console.error("Missing SUBSCRIPTION_REMINDERS_JOB_URL or CRON_SECRET");
    return new Response("Config Error", { status: 500 });
  }

  console.log(`Triggering subscription reminders job at: ${jobUrl}`);

  try {
    const response = await fetch(jobUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ triggered_at: new Date().toISOString() }),
    });

    const result = await response.text();

    if (!response.ok) {
      console.error(`Job failed with status ${response.status}: ${result}`);
      return new Response(result || "Job failed", { status: response.status });
    }

    console.log("Job triggered successfully");
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(`Fetch error: ${error.message}`);
    return new Response(error.message, { status: 500 });
  }
});
