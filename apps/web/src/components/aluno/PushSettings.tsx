"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/feedback/FeedbackSystem";

export function PushSettings({ escolaId }: { escolaId?: string | null }) {
  const { isSupported, isSubscribed, subscribe, unsubscribe, loading, permission } = usePushNotifications(escolaId);
  const { success, error } = useToast();

  if (!isSupported) return null;

  const handleToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await subscribe();
        success("Notificações ativadas", "Você receberá alertas importantes neste dispositivo.");
      } else {
        await unsubscribe();
        success("Notificações desativadas", "Você não receberá mais alertas neste dispositivo.");
      }
    } catch (err: any) {
      error("Erro", err.message || "Falha ao alterar configurações de notificação.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${isSubscribed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Notificações Push</p>
            <p className="text-xs text-muted-foreground">Alertas de notas, pagamentos e avisos.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={loading || permission === "denied"}
          />
        </div>
      </div>
      
      {permission === "denied" && (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
          As notificações estão bloqueadas no seu navegador. Ative-as nas configurações do site para receber alertas.
        </p>
      )}
    </div>
  );
}
