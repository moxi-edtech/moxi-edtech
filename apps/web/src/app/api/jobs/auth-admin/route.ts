import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AdminAction =
  | "createUser"
  | "inviteUserByEmail"
  | "updateUserById"
  | "deleteUser"
  | "getUserById"
  | "listUsers"
  | "generateLink";

type AdminRequest = {
  action: AdminAction;
  payload: Record<string, any>;
};

function resolveJobToken(req: Request) {
  return req.headers.get("x-job-token") || req.headers.get("authorization")?.replace("Bearer ", "");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key);
}

export async function POST(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.AUTH_ADMIN_JOB_TOKEN || process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase admin config missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as AdminRequest | null;
  if (!body || !body.action) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { action, payload } = body;

  try {
    switch (action) {
      case "createUser": {
        const { data, error } = await admin.auth.admin.createUser(payload as any);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "inviteUserByEmail": {
        const { email, options } = payload as any;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, options);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "updateUserById": {
        const { userId, attributes } = payload as any;
        const { data, error } = await admin.auth.admin.updateUserById(userId, attributes);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "deleteUser": {
        const { userId } = payload as any;
        const { data, error } = await admin.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "getUserById": {
        const { userId } = payload as any;
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "listUsers": {
        const { page, perPage } = payload as any;
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "generateLink": {
        const { data, error } = await (admin as any).auth.admin.generateLink(payload as any);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
