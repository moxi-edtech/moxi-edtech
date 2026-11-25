"use client";

import { useEffect, useState } from "react";
import { User, Lock, Mail, Phone, MapPin, Save, Loader2 } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { TableSkeleton } from "@/components/feedback/FeedbackSystem";
import { PushSettings } from "@/components/aluno/PushSettings";

export function TabPerfil() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingDados, setSavingDados] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);

  const [dados, setDados] = useState({
    nome: "",
    email: "",
    telefone: "",
    endereco: "",
    loginPortal: "",
    emailAuth: "",
    escola_id: "",
  });

  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    fetch("/api/aluno/perfil/dados")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.dados) {
          setDados({
            nome: json.dados.nome || "",
            email: json.dados.email_contato || json.dados.email || "",
            telefone: json.dados.telefone || json.dados.responsavel_contato || "",
            endereco: json.dados.endereco || "",
            loginPortal: json.dados.login_portal || "",
            emailAuth: json.dados.email_auth || "",
            escola_id: json.dados.escola_id || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSalvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDados(true);
    try {
      const res = await fetch("/api/aluno/perfil/dados", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: dados.email,
          telefone: dados.telefone,
          endereco: dados.endereco,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.dados) {
          setDados((current) => ({
            ...current,
            email: json.dados.email || "",
            telefone: json.dados.telefone || "",
            endereco: json.dados.endereco || "",
          }));
        }
        success(
          "Dados atualizados",
          json.message || "Suas informações de contato foram salvas com sucesso."
        );
      } else {
        throw new Error(json.error);
      }
    } catch (err: unknown) {
      error("Erro ao salvar", err instanceof Error ? err.message : "Não foi possível atualizar os dados.");
    } finally {
      setSavingDados(false);
    }
  };

  const handleSalvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmarSenha) {
      error("Senhas não coincidem", "A nova senha e a confirmação devem ser iguais.");
      return;
    }
    const failedRule = passwordRules(senha).find((rule) => !rule.ok);
    if (failedRule) {
      error("Senha inválida", failedRule.message);
      return;
    }

    setSavingSenha(true);
    try {
      const res = await fetch("/api/aluno/perfil/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha: senha }),
      });
      const json = await res.json();
      if (json.ok) {
        success("Senha atualizada", "Sua senha de acesso ao portal foi alterada com sucesso.");
        setSenhaAtual("");
        setSenha("");
        setConfirmarSenha("");
      } else {
        throw new Error(json.error);
      }
    } catch (err: unknown) {
      error("Erro ao alterar senha", err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setSavingSenha(false);
    }
  };

  if (loading) {
    return (
      <div className="min-w-0 space-y-4">
        <TableSkeleton rows={4} cols={1} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Perfil</h1>
      </header>

      {/* Atualização Cadastral */}
      <AlunoCard>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald/10 text-emerald dark:text-emerald-300"><User className="h-4 w-4" aria-hidden="true" /></span>
          <h2 className="text-sm font-semibold text-foreground">Dados pessoais</h2>
        </div>
        
        <form onSubmit={handleSalvarDados} className="space-y-4">
          <div>
            <label htmlFor="aluno-perfil-nome" className="mb-1 block text-xs font-semibold text-foreground">Nome do Aluno</label>
            <Input id="aluno-perfil-nome" value={dados.nome} disabled className="bg-muted/40" />
            <p className="mt-1 text-xs text-muted-foreground">O nome só pode ser alterado pela Direção da escola.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="aluno-perfil-login" className="mb-1 block text-xs font-semibold text-foreground">Login do Portal</label>
              <Input id="aluno-perfil-login" value={dados.loginPortal || dados.emailAuth || "—"} disabled className="bg-muted/40 font-mono" />
              <p className="mt-1 text-xs text-muted-foreground">
                Gerido pela secretaria.
              </p>
            </div>
            <div>
              <label htmlFor="aluno-perfil-email" className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <Mail className="h-3 w-3" /> Email de Contato
              </label>
              <Input id="aluno-perfil-email" 
                type="email" 
                value={dados.email} 
                onChange={(e) => setDados({ ...dados, email: e.target.value })} 
                placeholder="seu.email@exemplo.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Não altera o login do portal.
              </p>
            </div>
            <div>
              <label htmlFor="aluno-perfil-telefone" className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <Phone className="h-3 w-3" /> Telefone / WhatsApp
              </label>
              <Input id="aluno-perfil-telefone" 
                type="tel" 
                value={dados.telefone} 
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })} 
                placeholder="+244 9XX XXX XXX"
              />
            </div>
          </div>

          <div>
            <label htmlFor="aluno-perfil-morada" className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
              <MapPin className="h-3 w-3" /> Endereço
            </label>
            <Input id="aluno-perfil-morada" 
              value={dados.endereco} 
              onChange={(e) => setDados({ ...dados, endereco: e.target.value })} 
              placeholder="Sua morada completa"
            />
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={savingDados} tone="gold" className="w-full md:w-auto">
              {savingDados ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Dados
            </Button>
          </div>
        </form>
      </AlunoCard>

      {/* Redefinição de Senha */}
      <AlunoCard>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald/10 text-emerald dark:text-emerald-300"><Lock className="h-4 w-4" aria-hidden="true" /></span>
          <h2 className="text-sm font-semibold text-foreground">Segurança da conta</h2>
        </div>
        
        <form onSubmit={handleSalvarSenha} className="space-y-4">
          <div>
            <label htmlFor="aluno-perfil-senha-atual" className="mb-1 block text-xs font-semibold text-foreground">Senha Atual</label>
            <Input id="aluno-perfil-senha-atual"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              autoComplete="current-password"
              placeholder="Informe a senha atual"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="aluno-perfil-senha" className="mb-1 block text-xs font-semibold text-foreground">Nova Senha</label>
              <Input id="aluno-perfil-senha" 
                type="password" 
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label htmlFor="aluno-perfil-confirmacao" className="mb-1 block text-xs font-semibold text-foreground">Confirmar Nova Senha</label>
              <Input id="aluno-perfil-confirmacao" 
                type="password" 
                value={confirmarSenha} 
                onChange={(e) => setConfirmarSenha(e.target.value)} 
                autoComplete="new-password"
                placeholder="Repita a senha"
              />
            </div>
          </div>

          <ul className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
            {passwordRules(senha).map((rule) => (
              <li key={rule.message} className={rule.ok ? "text-emerald-600" : undefined}>
                {rule.ok ? "✓" : "•"} {rule.message}
              </li>
            ))}
          </ul>

          <div className="pt-2">
            <Button type="submit" disabled={savingSenha || !senhaAtual || !senha} variant="outline" className="w-full md:w-auto text-foreground">
              {savingSenha ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Alterar Senha
            </Button>
          </div>
        </form>
      </AlunoCard>
      <PushSettings escolaId={dados.escola_id} />
    </div>
  );
}

const passwordRules = (password: string) => [
  { ok: password.length >= 8, message: "Pelo menos 8 caracteres" },
  { ok: /[A-Z]/.test(password), message: "Uma letra maiúscula" },
  { ok: /[a-z]/.test(password), message: "Uma letra minúscula" },
  { ok: /\d/.test(password), message: "Um número" },
  { ok: /[^A-Za-z0-9]/.test(password), message: "Um caractere especial" },
];
