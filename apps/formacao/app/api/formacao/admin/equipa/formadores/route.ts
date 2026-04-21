import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { callAuthAdminJob } from "@/lib/auth-admin-job";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "super_admin", "global_admin"];

type ProfileRow = {
  user_id: string;
  nome: string;
  email: string | null;
};

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const size = 12;
  let value = "";
  for (let i = 0; i < size; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    value += alphabet[idx];
  }
  return value;
}

async function getFormadoresFromAuthAdmin(request: Request, escolaId: string) {
  const listData = (await callAuthAdminJob(request, "listUsers", { page: 1, perPage: 1000 })) as
    | {
        users?: Array<{
          id?: string | null;
          email?: string | null;
          app_metadata?: { role?: string | null; escola_id?: string | null; tenant_type?: string | null } | null;
          user_metadata?: { nome?: string | null; role?: string | null; escola_id?: string | null } | null;
        }>;
      }
    | null;

  const users = Array.isArray(listData?.users) ? listData.users : [];
  return users
    .filter((u) => {
      const appRole = String(u.app_metadata?.role ?? "").toLowerCase();
      const userRole = String(u.user_metadata?.role ?? "").toLowerCase();
      const role = appRole || userRole;
      const appEscola = String(u.app_metadata?.escola_id ?? "");
      const userEscola = String(u.user_metadata?.escola_id ?? "");
      const scopeEscola = appEscola || userEscola;
      return (
        scopeEscola === escolaId &&
        (role === "formador" || role === "formacao_formador" || role === "professor")
      );
    })
    .map((u) => {
      const userId = String(u.id ?? "");
      if (!userId) return null;
      const nome =
        String(u.user_metadata?.nome ?? "").trim() ||
        String(u.email ?? "").trim() ||
        "Formador";
      return {
        user_id: userId,
        nome,
        email: u.email ? String(u.email) : null,
      } satisfies ProfileRow;
    })
    .filter((row): row is ProfileRow => Boolean(row));
}

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  try {
    const items = await getFormadoresFromAuthAdmin(request, auth.escolaId);
    return NextResponse.json({
      ok: true,
      items: items.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar formadores" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | {
        nome?: string;
        email?: string;
        telefone?: string;
      }
    | null;

  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const telefone = String(body?.telefone ?? "").trim();

  if (!nome || !email) {
    return NextResponse.json({ ok: false, error: "nome e email são obrigatórios" }, { status: 400 });
  }

  try {
    const existingData = (await callAuthAdminJob(request, "findUserByEmail", { email })) as
      | { user?: { id?: string | null } | null }
      | null;
    const existing = existingData?.user ?? null;
    const tempPassword = generateTemporaryPassword();

    let userId = existing?.id ?? null;
    let createdNew = false;

    if (!userId) {
      const createdData = (await callAuthAdminJob(request, "createUser", {
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          nome,
          role: "formador",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
        app_metadata: {
          role: "formador",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
      })) as { user?: { id?: string | null } | null } | null;

      userId = createdData?.user?.id ?? null;
      if (!userId) throw new Error("Falha ao criar utilizador");
      createdNew = true;
    } else {
      await callAuthAdminJob(request, "updateUserById", {
        userId,
        attributes: {
          app_metadata: {
            role: "formador",
            escola_id: auth.escolaId,
            tenant_type: "formacao",
          },
        },
      });
    }

    await callAuthAdminJob(request, "upsertProfile", {
      profile: {
        user_id: userId,
        email,
        nome,
        telefone: telefone || null,
        role: "formador",
        escola_id: auth.escolaId,
        current_escola_id: auth.escolaId,
      },
      onConflict: "user_id",
    });

    await callAuthAdminJob(request, "upsertEscolaUser", {
      escolaUser: {
          escola_id: auth.escolaId,
          user_id: userId,
          papel: "formador",
          tenant_type: "formacao",
      },
    });

    return NextResponse.json({
      ok: true,
      item: { user_id: userId, nome, email },
      created_new: createdNew,
      temporary_password: createdNew ? tempPassword : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao cadastrar formador" },
      { status: 400 }
    );
  }
}
