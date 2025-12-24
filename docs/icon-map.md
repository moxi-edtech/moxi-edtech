Aqui está o IconMap oficial da KLASSE — isso vira padrão de equipa e elimina decisões ad-hoc no futuro.

Biblioteca oficial: Lucide Icons
Motivo: consistência, leveza, enterprise SaaS, zero ruído visual.

⸻

📘 ICON MAP — KLASSE (OFICIAL)

🧭 Navegação principal (Sidebar)

Módulo	Ícone (Lucide)	Motivo
Dashboard	LayoutDashboard	Visão geral clara
Alunos	Users	Padrão universal
Matrículas	GraduationCap	Educação / progresso
Turmas	UsersRound	Grupos / salas
Professores	UserCheck	Autoridade / vínculo
Acadêmico	BookOpen	Currículo / ensino
Disciplinas	Library	Conteúdo estruturado
Avaliações	ClipboardCheck	Controle / validação
Frequência	CalendarCheck	Presença
Financeiro	Wallet	Caixa / pagamentos
Faturas	Receipt	Documentos financeiros
Relatórios	BarChart3	Dados / análise
Configurações	Settings	Sistema
Usuários	Shield	Acesso / permissões


⸻

🧑‍💼 Perfil & Conta

Uso	Ícone
Perfil	User
Conta da escola	Building2
Segurança	Lock
Notificações	Bell
Sair	LogOut


⸻

⚙️ Ações comuns (botões)

Ação	Ícone	Regra de uso
Criar	Plus	Sempre com texto
Editar	Pencil	Nunca sozinho
Ver	Eye	Visualização
Excluir	Trash2	Sempre vermelho
Confirmar	Check	Verde
Cancelar	X	Neutro
Upload	Upload	Importações
Download	Download	Exportações
Buscar	Search	Inputs
Filtrar	Filter	Tabelas
Mais opções	MoreVertical	Menus


⸻

🎨 PADRÃO VISUAL DO ÍCONE (IMPORTANTE)

Tamanho

Sidebar: 20px (h-5 w-5)
Botão:   16px (h-4 w-4)
Cards:   24px (h-6 w-6)

Cores

Default: text-slate-400
Hover:   text-klasse-gold
Ativo:   text-klasse-gold
Erro:    text-red-500

Nunca fazer
	•	❌ Ícone sem texto no desktop
	•	❌ Ícone colorido aleatório
	•	❌ Ícones de estilos diferentes

⸻

🧱 COMPONENTE PADRÃO (RECOMENDADO)

IconBadge.tsx

import { LucideIcon } from "lucide-react";

export function IconBadge({
  icon: Icon,
  active,
}: {
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <div
      className={[
        "h-9 w-9 rounded-xl flex items-center justify-center",
        active
          ? "bg-klasse-gold/15 ring-1 ring-klasse-gold/25"
          : "bg-slate-800/70",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-5 w-5",
          active ? "text-klasse-gold" : "text-slate-400",
        ].join(" ")}
      />
    </div>
  );
}


⸻

📌 REGRA FINAL (GUARDA ISSO)

Ícones não decoram.
Ícones orientam.

Quando todos seguem o mesmo IconMap:
	•	UI parece mais cara
	•	Usuário aprende mais rápido
	•	Produto escala sem virar Frankenstein