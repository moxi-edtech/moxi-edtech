# Matriz RBAC Operacional - Admin da Escola

Versao: 1.0.0
Data: 2026-04-03
Escopo: Operacao diaria do portal admin para usuario final.

## Legenda
- `E`: executa diretamente
- `V`: visualiza/acompanha
- `NA`: nao aplicavel neste perfil

## Matriz resumida por processo

| Processo | admin_escola | secretaria | financeiro | professor |
|---|---|---|---|---|
| Consultar dashboard admin | E | V | V | NA |
| Rever alertas operacionais | E | V | V | NA |
| Gerir alunos (listar, filtrar, editar) | E | E | V | NA |
| Arquivar aluno | E | E | NA | NA |
| Restaurar aluno | E | E | NA | NA |
| Eliminar permanentemente aluno | E (com aprovacao interna) | NA | NA | NA |
| Registar pagamento rapido no contexto aluno | E (quando habilitado) | E | E | NA |
| Publicar curriculo | E | E (quando autorizado) | NA | NA |
| Gerar turmas a partir de curriculo | E | E (quando autorizado) | NA | NA |
| Ajustar calendario/periodos | E | E (quando autorizado) | NA | NA |
| Ajustar avaliacao e frequencia | E | E (quando autorizado) | NA | V |
| Configurar parametros financeiros da escola | E | V | E | NA |
| Emitir avisos/eventos administrativos | E | E | V | NA |
| Consultar relatorios de auditoria | E | V | V | NA |
| Executar manutencao administrativa (refresh/partitions) | E restrito | NA | NA | NA |

## Regras operacionais obrigatorias

1. O operador deve atuar apenas no portal e escola em que esta autenticado.
2. Acoes destrutivas (hard delete) exigem dupla confirmacao operacional.
3. Processos de setup/configuracao devem usar fluxo completo de validacao antes de concluir.
4. Sempre que houver bloqueio de permissao, registrar o caso e escalar para administracao da escola.

## Escalonamento padrao

- Falha de permissao: Gestor de plataforma / suporte interno
- Divergencia de dados: Secretaria + Admin da Escola
- Incidente financeiro: Financeiro + Admin da Escola
- Erro recorrente de sistema: Engenharia/Suporte tecnico

