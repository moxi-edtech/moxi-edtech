"use client";

import { AlertTriangle, LogOut, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function EscolaSuspensaPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/redirect");
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-3xl shadow-xl border border-border p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto border border-rose-100">
          <AlertTriangle className="w-10 h-10 text-rose-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Acesso Suspenso</h1>
          <p className="text-muted-foreground text-sm">
            O acesso a esta instituição foi temporariamente suspenso devido a pendências administrativas ou financeiras.
          </p>
        </div>

        <div className="bg-muted rounded-2xl p-4 border border-border text-left">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Próximos Passos</p>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-klasse-green mt-1 shrink-0" />
              Contacte o administrador ou diretor da sua instituição.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-klasse-green mt-1 shrink-0" />
              Regularize os pagamentos da subscrição Klasse através do portal financeiro.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            fullWidth 
            tone="green" 
            className="bg-klasse-green hover:bg-klasse-green/90 font-bold"
            onClick={() => window.open('https://wa.me/244944811150', '_blank')}
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Falar com Suporte
          </Button>
          <button 
            onClick={handleLogout}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Código de Erro: ESCOLA_SUSPENSA_FINANCEIRO
        </p>
      </div>
    </div>
  );
}
