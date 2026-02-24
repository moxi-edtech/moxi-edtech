import "server-only";

type AdminAction =
  | "createUser"
  | "inviteUserByEmail"
  | "updateUserById"
  | "deleteUser"
  | "getUserById"
  | "listUsers"
  | "generateLink"
  | "findUserByEmail"
  | "resolveIdentifierToEmail"
  | "activateStudentAccess"
  | "seedSuperAdmin"
  | "seedTest";

type AdminRequest = {
  action: AdminAction;
  payload: Record<string, any>;
};

export async function callAuthAdminJob(req: Request, action: AdminAction, payload: Record<string, any>) {
  const token = process.env.AUTH_ADMIN_JOB_TOKEN || process.env.CRON_SECRET;
  if (!token) {
    throw new Error("Missing AUTH_ADMIN_JOB_TOKEN or CRON_SECRET");
  }

  const origin = new URL(req.url).origin;
  const response = await fetch(`${origin}/api/jobs/auth-admin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-job-token": token,
    },
    body: JSON.stringify({ action, payload } satisfies AdminRequest),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const errorMessage = data?.error || "Auth admin job failed";
    throw new Error(errorMessage);
  }

  return data.data;
}
