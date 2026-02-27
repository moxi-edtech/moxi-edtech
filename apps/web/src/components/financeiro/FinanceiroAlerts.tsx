"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Check } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { Database } from "~types/supabase";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function FinanceiroAlerts({ notifications }: { notifications: Notification[] }) {
  const [items, setItems] = useState<Notification[]>(notifications || []);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleMarkAsRead(id: string) {
    setLoadingId(id);
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));

    const { error } = await supabase
      .from("notifications")
      .update({ lida: true })
      .eq("id", id);

    setLoadingId(null);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      setItems(previous);
      return;
    }

    router.refresh();
  }

  if (!items?.length) return null;

  return (
    <div className="mb-6 animate-in slide-in-from-top-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-klasse-gold/15 p-1.5 text-klasse-gold">
            <BellRing className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Ações Pendentes ({items.length})
          </h3>
        </div>

        <div className="space-y-2">
          {items.map((notif) => (
            <div
              key={notif.id}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/30 p-3 transition-colors hover:border-klasse-gold/40"
            >
              <div>
                <p className="text-sm font-bold text-slate-700">{notif.titulo}</p>
                <p className="text-xs text-slate-500">{notif.mensagem}</p>
              </div>

              <div className="flex gap-2">
                {notif.link_acao && (
                  <Link
                    href={notif.link_acao}
                    className="inline-flex items-center gap-1 rounded-lg border border-klasse-gold/30 bg-klasse-gold/10 px-3 py-1.5 text-xs font-bold text-klasse-gold transition-colors hover:bg-klasse-gold/20"
                  >
                    Configurar <ArrowRight className="w-3 h-3" />
                  </Link>
                )}

                <button
                  onClick={() => handleMarkAsRead(notif.id)}
                  disabled={loadingId === notif.id}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-klasse-gold/10 hover:text-klasse-gold disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
