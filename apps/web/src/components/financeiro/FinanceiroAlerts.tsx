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
      <div className="bg-klasse-gold-50 border border-klasse-gold-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-klasse-gold-100 rounded-lg text-klasse-gold-700">
            <BellRing className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-klasse-gold-800 text-sm">
            Ações Pendentes ({items.length})
          </h3>
        </div>

        <div className="space-y-2">
          {items.map((notif) => (
            <div
              key={notif.id}
              className="bg-white p-3 rounded-lg border border-klasse-gold-100 shadow-sm flex justify-between items-center group hover:border-klasse-gold-300 transition-all"
            >
              <div>
                <p className="text-sm font-bold text-slate-700">{notif.titulo}</p>
                <p className="text-xs text-slate-500">{notif.mensagem}</p>
              </div>

              <div className="flex gap-2">
                {notif.link_acao && (
                  <Link
                    href={notif.link_acao}
                    className="text-xs bg-klasse-gold-100 text-klasse-gold-800 px-3 py-1.5 rounded-lg font-bold hover:bg-klasse-gold-200 flex items-center gap-1"
                  >
                    Configurar <ArrowRight className="w-3 h-3" />
                  </Link>
                )}

                <button
                  onClick={() => handleMarkAsRead(notif.id)}
                  disabled={loadingId === notif.id}
                  className="text-slate-400 hover:text-klasse-green-600 p-1.5 hover:bg-klasse-green-50 rounded-lg transition-colors disabled:opacity-50"
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
