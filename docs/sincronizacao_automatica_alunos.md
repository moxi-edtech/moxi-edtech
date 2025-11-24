📘 Documento Técnico — Sincronização Automática de Alunos (ensure_aluno_from_escola_usuario)
🧩 Contexto

No Moxi Nexa, um “aluno” é entendido como um usuário vinculado a uma escola com o papel “aluno”.
Esse vínculo é representado na tabela:

public.escola_usuarios


Por outro lado, os dados administrativos e operacionais dos estudantes são armazenados em:

public.alunos


Isso cria um problema natural de consistência:
Um usuário pode estar marcado como aluno (papel = 'aluno') sem existir na tabela alunos. Isso quebra listagens, matrículas, financeiro e vários fluxos da Secretaria.

Para resolver isso, implementamos um gatilho automático que garante que cada usuário com papel de aluno tenha uma linha correspondente em public.alunos.

🎯 Objetivo do Trigger

Garantir, de maneira automática e contínua, que:

Todo usuário vinculado a uma escola como “aluno” exista formalmente na tabela alunos.

Sem telas extras, sem scripts manuais, sem manutenção periódica.

O trigger atua como uma materialização automática do vínculo administrativo.

🏗️ Arquitetura da Solução
1. Fonte de verdade

Os dados pessoais (nome, sexo, telefone, BI, etc.) vivem em public.profiles.

O vínculo com a escola vive em public.escola_usuarios.

2. Projeção administrativa

A tabela public.alunos representa:

A identidade do estudante dentro daquela escola.

É uma projeção específica do domínio “Escola”.

3. Sincronização automática

Sempre que algo como isto acontecer:

INSERT INTO escola_usuarios (user_id, escola_id, papel)
VALUES ('xxx', 'yyy', 'aluno');


O sistema automaticamente:

Cria o aluno (se não existir).

Atualiza o aluno (se existir).

Mantém os dados coerentes com profiles.

⚙️ Como o Trigger Funciona
📌 Função: ensure_aluno_from_escola_usuario()

Valida se o vínculo é de aluno
Se NEW.papel != 'aluno' → ignora.

Busca dados básicos do profile
(nome e telefone).
Se o profile não existir → ignora (evita aluno fantasma).

Executa um UPSERT na tabela alunos:

Se já existe um aluno com (profile_id, escola_id)
→ apenas atualiza updated_at, nome, telefone.

Se não existe
→ cria um novo aluno, preenchendo:

nome

profile_id

telefone_responsavel

escola_id

status='ativo'

Garante atomicidade e elimina condições de corrida.

🔒 RLS — Segurança Mantida

O trigger roda com SECURITY DEFINER, o que significa:

Usa os privilégios do dono da função (normalmente postgres).

Ignora RLS para garantir consistência interna.

O usuário da API não ganha privilégios extras.

⚡ Benefícios da Abordagem
✔️ Consistência garantida

Nenhum aluno some da lista da Secretaria.

✔️ Automação completa

O backend se auto-organiza. Nada precisa ser sincronizado manualmente.

✔️ Respeito ao domínio

profiles = pessoa
escola_usuarios = vínculo
alunos = aluno naquela escola

✔️ Failsafe

Se o front não enviar nome, telefone, documentos etc.
→ ainda assim haverá linha administrativa mínima.

✔️ Seguro e evolutivo

Podemos estender a lógica depois (ex.: histórico, auditoria, sincronização BI).

⚠️ Riscos e Como Mitigamos
Risco	Mitigação
Race condition (duas inserções simultâneas)	UPSERT + unique(profile_id, escola_id)
Criar aluno sem profile	Função valida profile antes
Dados incompletos	COALESCE para campos críticos
Trigger proliferando responsabilidades	Função pequena e focada
RLS bloquear operação	SECURITY DEFINER corrige
