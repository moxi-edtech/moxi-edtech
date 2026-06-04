"use client";

import { useEffect, useState } from "react";
import { User, Lock, Mail, Phone, MapPin, Save, Loader2 } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { TableSkeleton } from "@/components/feedback/FeedbackSystem";

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
  });

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    fetch("/api/aluno/perfil/dados")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.dados) {
          setDados({
            nome: json.dados.nome || "",
            email: json.dados.email || "",
            telefone: json.dados.telefone || json.dados.responsavel_contato || "",
            endereco: json.dados.endereco || "",
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
        success("Dados atualizados", "Suas informações de contato foram salvas com sucesso.");
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      error("Erro ao salvar", err.message || "Não foi possível atualizar os dados.");
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
    if (senha.length < 6) {
      error("Senha muito curta", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSavingSenha(true);
    try {
      const res = await fetch("/api/aluno/perfil/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const json = await res.json();
      if (json.ok) {
        success("Senha atualizada", "Sua senha de acesso ao portal foi alterada com sucesso.");
        setSenha("");
        setConfirmarSenha("");
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      error("Erro ao alterar senha", err.message || "Não foi possível redefinir a senha.");
    } finally {
      setSavingSenha(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={4} cols={1} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <SectionTitle>Meu Perfil</SectionTitle>
        <p className="text-xs text-slate-500">Gerencie seus dados de contato e segurança.</p>
      </header>

      {/* Atualização Cadastral */}
      <AlunoCard>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <User className="h-4 w-4 text-klasse-gold" />
          <h2 className="text-sm font-semibold text-slate-900">Atualização Cadastral</h2>
        </div>
        
        <form onSubmit={handleSalvarDados} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nome do Aluno</label>
            <Input value={dados.nome} disabled className="bg-slate-50" />
            <p className="mt-1 text-[10px] text-slate-400">O nome só pode ser alterado pela secretaria.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Mail className="h-3 w-3" /> Email
              </label>
              <Input 
                type="email" 
                value={dados.email} 
                onChange={(e) => setDados({ ...dados, email: e.target.value })} 
                placeholder="seu.email@exemplo.com"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Phone className="h-3 w-3" /> Telefone / WhatsApp
              </label>
              <Input 
                type="tel" 
                value={dados.telefone} 
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })} 
                placeholder="+244 9XX XXX XXX"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
              <MapPin className="h-3 w-3" /> Endereço
            </label>
            <Input 
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
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <Lock className="h-4 w-4 text-klasse-gold" />
          <h2 className="text-sm font-semibold text-slate-900">Segurança da Conta</h2>
        </div>
        
        <form onSubmit={handleSalvarSenha} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Nova Senha</label>
              <Input 
                type="password" 
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Confirmar Nova Senha</label>
              <Input 
                type="password" 
                value={confirmarSenha} 
                onChange={(e) => setConfirmarSenha(e.target.value)} 
                placeholder="Repita a senha"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={savingSenha || !senha} variant="outline" className="w-full md:w-auto text-slate-700">
              {savingSenha ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Alterar Senha
            </Button>
          </div>
        </form>
      </AlunoCard>
    </div>
  );
}
