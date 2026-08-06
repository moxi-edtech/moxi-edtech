# Plano de Virada Académica 2026/2027 — Escola Curtume

**Escola:** Complexo Escolar Privado Advetista de Curtume

**Escola ID:** `3744879f-2e19-4671-8995-78604302d8c5`

**Data de referência:** 3 de agosto de 2026

**Versão do plano:** 1.1

**Estado:** Preparação — novo ano ainda não ativado

## Decisões confirmadas em 3 de agosto de 2026

| Decisão | Definição aprovada | Consequência operacional |
|---|---|---|
| Fonte dos resultados | Planilha fornecida pela escola | A planilha deve ser validada e reconciliada antes da importação |
| Alunos da 9.ª classe | Não transitam dentro da Curtume | Encerrar como concluintes e preservar integralmente o histórico escolar |
| Preçário 2026/2027 | Será reajustado | Nenhum preço de 2025 pode ser publicado automaticamente |
| Perfis participantes | `Admin_Financeiro`, `Admin`, `Diretor`, `Super Admin` | Aplicar separação entre aprovação financeira, académica e ativação |
| Canais de rematrícula | Portal do aluno/encarregado e secretaria | Ambos alimentam a mesma fila e criam uma única matrícula por aluno/ano |
| Canais de novos alunos | Portal público de candidaturas e secretaria | Ambos usam o mesmo processo de candidatura, análise e conversão |

### Matriz de aprovação

| Operação | Aprovação mínima |
|---|---|
| Importar resultados e decidir transição | `Admin`, `Diretor` ou `Super Admin` |
| Aprovar o preçário | `Admin_Financeiro` e um de: `Admin`, `Diretor`, `Super Admin` |
| Executar rematrícula em lote | `Admin`, `Diretor` ou `Super Admin`, após gate financeiro |
| Ativar 2026/2027 | `Diretor`, `Admin` ou `Super Admin`; `Admin_Financeiro` não ativa sozinho |

> A lista define os perfis participantes informados pela escola, mas preserva segregação de funções: aprovação financeira não substitui decisão académica.

## 1. Objetivo

Preparar e executar a transição controlada do ano letivo 2025/2026 para 2026/2027, preservando o histórico académico e financeiro, aplicando o calendário oficial do MED e impedindo promoções, ativações ou cobranças incorretas.

## 2. Princípios de execução

1. O ano 2026/2027 deve ser criado inicialmente como **inativo**.
2. Nenhuma matrícula de 2025/2026 pode ser alterada para representar 2026/2027.
3. Cada aluno promovido deve receber uma nova matrícula ligada ao novo ano e à nova turma.
4. Promoção académica depende de resultado final validado; dívida financeira não determina aprovação ou retenção.
5. Preços de 2025 não podem ser copiados para 2026 sem aprovação da direção.
6. O ano novo só pode ser ativado depois de todos os gates obrigatórios estarem verdes.
7. Toda operação em lote deve produzir pré-visualização, registo de auditoria e mecanismo de reversão.

## 3. Estado atual verificado

| Área | Estado em 03/08/2026 | Risco |
|---|---:|---|
| Ano letivo ativo | 2025/2026, terminado em 31/07/2026 | Ano encerrado no calendário, mas ainda ativo no sistema |
| Ano 2026/2027 na escola | Inexistente | Não há destino para turmas e matrículas novas |
| Matrículas ativas | 564 | Não podem ser promovidas em massa sem resultado final |
| Turmas de 2025/2026 | 22, todas `ABERTO` | Fecho académico ainda não concluído |
| Alunos com alguma nota | 5 | Cobertura académica insuficiente |
| Alunos sem qualquer nota | 559 | Bloqueador crítico de promoção automática |
| Candidaturas aprovadas | 17 | Aguardam decisão/conversão operacional |
| Candidaturas submetidas | 5 | Precisam de análise |
| Candidaturas pendentes | 2 | Precisam de resolução |
| Candidaturas em rascunho | 13 | Precisam de contacto ou expiração |
| Tabelas financeiras 2025 | 10 | Servem apenas como referência para proposta 2026 |
| Tabelas financeiras 2026 | 0 | Bloqueia cobrança correta no novo ano |
| Mensalidades vencidas pendentes | 1.918 | Exige plano financeiro separado |
| Saldo pendente | 5.089.000 Kz | Envolve 341 alunos |
| Eventos de calendário aplicados à escola | 0 | Agenda operacional não está configurada |

## 4. Calendário operacional

| Janela | Atividade principal | Resultado esperado |
|---|---|---|
| 3–7 de agosto | Preparação técnica, recolha de resultados e abertura do novo ano inativo | Ambiente 2026/2027 pronto sem impacto operacional |
| 2–13 de agosto | Inscrição, seleção e publicação de listas de novos alunos | Candidaturas analisadas e lista aprovada |
| 8–13 de agosto | Decisões de transição, desenho de turmas e aprovação do preçário | Propostas validadas pela direção |
| 14–15 de agosto | Conferência final antes das matrículas novas | Dados, turmas e preços prontos |
| 16–20 de agosto | Matrículas de novos alunos | Novos alunos matriculados no ano inativo |
| 16–23 de agosto | Rematrícula controlada dos alunos elegíveis | Novas matrículas criadas sem sobrescrever 2025 |
| 24–27 de agosto | Alocação docente, disciplinas, horários e validação operacional | Turmas prontas para funcionar |
| 28–30 de agosto | Checklist final e decisão de ativação | Autorização formal da direção |
| 31 de agosto | Abertura oficial de 2027/2028 conforme o documento MED | Evento registado; confirmar nomenclatura ministerial |
| 1 de setembro | Início das aulas de 2026/2027 | Ano ativo e operação iniciada |

> **Nota de fonte:** o documento oficial denomina o evento de 31 de agosto como abertura de 2027/2028, embora esteja dentro do calendário 2026/2027. O KLASSE deve preservar o texto da fonte e sinalizar a inconsistência para validação do MED.

## 5. Fases de execução

### Fase 0 — Governança e cópia de segurança

**Responsáveis:** Direção, administrador KLASSE e responsável técnico

**Prazo:** 3 de agosto

- [ ] Nomear um responsável da direção para aprovar resultados, preços e ativação.
- [ ] Exportar inventário de anos, turmas, matrículas, notas, candidaturas e mensalidades.
- [ ] Registar contagens de controlo antes de qualquer mutação.
- [ ] Confirmar que a migração `20270803110000` consta no histórico Supabase.
- [ ] Publicar o código que suporta `PERIODO_LETIVO` com fallback legado.
- [ ] Definir janela de manutenção e canal de comunicação com a escola.

**Gate F0:** backup lógico disponível, responsáveis nomeados e código compatível publicado.

### Fase 1 — Criar o ano 2026/2027 inativo

**Responsáveis:** Administrador KLASSE e secretaria

**Prazo:** 3–5 de agosto

- [ ] Criar ano letivo 2026 com início em `2026-09-01` e fim em `2027-08-31`.
- [ ] Garantir `ativo = false`.
- [ ] Aplicar o template `REGULAR_ADULTOS`.
- [ ] Confirmar três períodos letivos com pesos `30/30/40`.
- [ ] Confirmar três épocas de provas distintas dos períodos.
- [ ] Confirmar pausas, feriados, exames, conselhos, pautas, matrículas e encerramento.
- [ ] Confirmar que o ano 2025 continua disponível para fecho.

**Gate F1:** ano inativo criado, calendário aplicado e zero matrículas criadas automaticamente.

### Fase 2 — Fechar academicamente 2025/2026

**Responsáveis:** Direção pedagógica, professores e secretaria

**Prazo:** 3–10 de agosto

**Bloqueador atual:** 559 de 564 alunos não possuem notas no KLASSE.

- [ ] Receber a planilha de resultados da Curtume no workspace seguro.
- [ ] Validar cabeçalhos, identificadores de aluno, turmas, disciplinas, períodos e escala de notas.
- [ ] Rejeitar linhas sem correspondência única de aluno/matrícula.
- [ ] Produzir pré-visualização com válidos, avisos, rejeitados e duplicados.
- [ ] Identificar onde estão os resultados oficiais: papel, Excel ou outro sistema.
- [ ] Definir formato único de importação ou lançamento manual.
- [ ] Validar pautas por turma e disciplina.
- [ ] Classificar cada aluno como `TRANSITADO`, `RETIDO`, `CONCLUÍDO` ou `PENDENTE`.
- [ ] Tratar transferências, desistências, falecimentos e matrículas anuladas separadamente.
- [ ] Fechar as 22 turmas somente após validação da direção.
- [ ] Manter evidência da decisão final por matrícula.

**Gate F2:** 100% das matrículas possuem decisão final ou exceção formal registada.

### Fase 3 — Projetar turmas 2026/2027

**Responsáveis:** Direção pedagógica e secretaria

**Prazo:** 8–13 de agosto

Projeção bruta antes dos resultados finais:

| Origem 2025/2026 | Destino proposto | Alunos atuais |
|---|---|---:|
| Pré-escolar | 1.ª classe | 14 |
| 1.ª classe | 2.ª classe | 40 |
| 2.ª classe | 3.ª classe | 44 |
| 3.ª classe | 4.ª classe | 41 |
| 4.ª classe | 5.ª classe | 44 |
| 5.ª classe | 6.ª classe | 58 |
| 6.ª classe | 7.ª classe | 54 |
| 7.ª classe | 8.ª classe | 125 |
| 8.ª classe | 9.ª classe | 84 |
| 9.ª classe | Conclusão; histórico preservado na Curtume | 60 |

- [ ] Recalcular projeções após resultados finais.
- [ ] Definir número de turmas por classe, turno, sala e capacidade.
- [ ] Classificar os 60 alunos da 9.ª classe como concluintes após validação dos resultados finais.
- [ ] Não criar matrícula 2026/2027 para esses concluintes.
- [ ] Garantir emissão posterior de histórico, declaração e pauta sem depender de matrícula ativa.
- [ ] Criar turmas inicialmente sem matrículas.
- [ ] Validar códigos de turma e impedir duplicação.
- [ ] Não copiar professores automaticamente sem confirmação de disponibilidade.

**Gate F3:** turmas aprovadas e capacidade suficiente para promovidos e novos alunos.

### Fase 4 — Admissões de novos alunos

**Responsáveis:** Secretaria e direção

**Prazo:** seleção até 13 de agosto; matrícula de 16 a 20 de agosto

- [ ] Rever 17 candidaturas aprovadas.
- [ ] Decidir 5 candidaturas submetidas.
- [ ] Resolver 2 candidaturas pendentes.
- [ ] Contactar ou expirar 13 rascunhos.
- [ ] Verificar documentos, classe pretendida, turno e capacidade.
- [ ] Publicar lista final aprovada.
- [ ] Converter candidatura em matrícula apenas entre 16 e 20 de agosto.
- [ ] Garantir idempotência: uma candidatura não pode gerar duas matrículas.
- [ ] Manter o portal público de candidaturas aberto durante a janela oficial.
- [ ] Permitir à secretaria registar candidatura assistida para famílias atendidas presencialmente.
- [ ] Gerar `protocolo_publico` nos dois canais.
- [ ] Usar os mesmos estados, documentos obrigatórios e critérios de decisão nos dois canais.
- [ ] Pesquisar por documento, nome e contacto antes de criar candidatura assistida.
- [ ] Fazer a conversão para matrícula apenas pela operação oficial de admissão.

**Gate F4:** todas as candidaturas têm decisão e as matrículas respeitam capacidade e ano letivo.

### Fase 5 — Aprovar o preçário 2026/2027

**Responsáveis:** Direção e financeiro

**Prazo:** 8–13 de agosto

Referência 2025/2026:

- matrícula: 1.400–2.300 Kz;
- mensalidade: 2.000–4.000 Kz;
- 10 combinações de preço por classe/curso.

- [ ] Gerar proposta 2026 a partir da estrutura de 2025, sem publicar.
- [ ] Recolher percentuais ou valores reajustados por classe/curso.
- [ ] Aprovar matrícula, mensalidade, vencimento, multa e descontos.
- [ ] Definir data de início financeiro por matrícula.
- [ ] Separar cobrança de 2026 da dívida de 2025.
- [ ] Impedir geração de mensalidades antes da confirmação da matrícula.
- [ ] Validar totais numa amostra antes da geração em lote.

**Gate F5:** preçário assinado pela direção e simulação financeira validada.

### Fase 6 — Rematrícula e promoção controlada

**Responsáveis:** Secretaria e direção pedagógica

**Prazo:** 16–23 de agosto

- [ ] Gerar pré-visualização por aluno: turma anterior, decisão final, classe proposta e nova turma.
- [ ] Excluir retidos, concluídos e pendentes do lote automático.
- [ ] Exigir confirmação humana antes de cada lote.
- [ ] Criar nova matrícula em 2026; nunca atualizar a matrícula de 2025.
- [ ] Guardar `origem_transicao_matricula_id`.
- [ ] Transportar desconto somente quando aprovado.
- [ ] Não transportar dívida como mensalidade do novo ano.
- [ ] Produzir relatório de sucessos, rejeições e alunos sem destino.
- [ ] Abrir a janela de rematrícula no portal somente para alunos elegíveis.
- [ ] Mostrar ao aluno/encarregado a classe proposta, documentos, dívida informativa e termos.
- [ ] Permitir confirmação autónoma pelo portal do aluno/encarregado.
- [ ] Permitir confirmação assistida pela secretaria quando a família comparecer presencialmente.
- [ ] Registar `canal = PORTAL_ALUNO` ou `canal = SECRETARIA` no evento de auditoria.
- [ ] Se a secretaria confirmar primeiro, o portal deve mostrar a rematrícula como concluída.
- [ ] Se o portal confirmar primeiro, a secretaria deve visualizar a mesma matrícula, sem criar outra.
- [ ] Usar `origem_transicao_matricula_id` como vínculo idempotente entre matrícula antiga e nova.

**Gate F6:** total de novas matrículas reconciliado com transitados, retidos, concluídos e exceções.

### Regras comuns dos fluxos multicanal

```text
Portal do aluno ─┐
                 ├─> elegibilidade ─> confirmação única ─> matrícula 2026
Secretaria ──────┘

Portal público ─┐
                ├─> candidatura única ─> análise ─> aprovação ─> matrícula 2026
Secretaria ─────┘
```

Regras obrigatórias:

1. O canal muda a origem do pedido, não as regras de negócio.
2. Toda tentativa repetida deve devolver o resultado já existente.
3. Documento normalizado, aluno, ano e vínculo de transição devem impedir duplicados.
4. A secretaria pode assistir e corrigir pendências, mas não contornar capacidade, período ou aprovação.
5. O portal nunca ativa o ano, cria preços ou decide promoção académica.
6. Toda mudança de estado deve entrar no histórico da candidatura ou da rematrícula.

### Fase 7 — Preparação pedagógica e operacional

**Responsáveis:** Direção pedagógica, coordenação e professores

**Prazo:** 24–27 de agosto

- [ ] Associar disciplinas a cada turma.
- [ ] Atribuir professores e diretores de turma.
- [ ] Configurar modelos de avaliação.
- [ ] Confirmar horários, salas e turnos.
- [ ] Validar acessos de secretaria, professores, alunos e encarregados.
- [ ] Publicar comunicação de início das aulas.
- [ ] Executar testes de pauta, frequência, cobrança e recibo numa turma piloto.

**Gate F7:** nenhuma turma sem disciplinas essenciais, responsável ou configuração de avaliação.

### Fase 8 — Ativação

**Responsáveis:** Direção e administrador KLASSE

**Prazo:** 28 de agosto a 1 de setembro

- [ ] Executar checklist final.
- [ ] Registar aprovação formal da direção.
- [ ] Ativar 2026/2027 numa operação única e auditada.
- [ ] Desativar 2025/2026 sem apagar ou reescrever o histórico.
- [ ] Confirmar que apenas um ano está ativo.
- [ ] Monitorizar erros, matrículas, cobranças e acessos nas primeiras 48 horas.

**Gate F8:** 2026/2027 ativo, 2025/2026 fechado e todas as reconciliações aprovadas.

## 6. Tratamento financeiro da dívida antiga

Existem 341 alunos com mensalidades vencidas, totalizando 5.089.000 Kz.

Regras:

- dívida não reprova nem altera a classe académica;
- dívida não deve ser copiada como mensalidade de 2026;
- a rematrícula pode exigir revisão financeira, mas precisa de decisão explícita da escola;
- acordos, descontos e perdões devem possuir autorização e auditoria;
- pagamentos posteriores devem continuar ligados ao título e ano de origem.

Segmentação sugerida:

1. Sem dívida: fluxo normal de rematrícula.
2. Dívida baixa: notificação e acordo simplificado.
3. Dívida elevada: revisão individual pelo financeiro.
4. Divergência ou pagamento não conciliado: bloquear somente a conclusão financeira, não a decisão académica.

## 7. Exceção do pré-escolar

A escola possui 14 alunos do pré-escolar. O template instalado é específico para ensino primário e secundário regular/adultos.

Até existir um template MED próprio para pré-escolar:

- [ ] não assumir que todas as datas do template regular se aplicam ao pré-escolar;
- [ ] manter lista explícita de exceções;
- [ ] validar pausas, encerramento e atividades com a coordenação do pré-escolar;
- [ ] evitar comunicações automáticas globais quando a data divergir.

## 8. Checklist bloqueante de ativação

O ano 2026/2027 **não pode ser ativado** enquanto qualquer item estiver em falta:

- [ ] Histórico da migração regularizado.
- [ ] Código `PERIODO_LETIVO` publicado.
- [ ] Ano 2026/2027 criado e inativo.
- [ ] Calendário aplicado e verificado.
- [ ] Resultados finais validados.
- [ ] 22 turmas antigas fechadas.
- [ ] Decisão final para todas as 564 matrículas.
- [ ] Turmas novas aprovadas.
- [ ] Candidaturas processadas.
- [ ] Preçário 2026 aprovado.
- [ ] Rematrículas reconciliadas.
- [ ] Disciplinas e professores atribuídos.
- [ ] Teste piloto concluído.
- [ ] Aprovação formal da direção registada.

## 9. Métricas de reconciliação

Antes da ativação, o relatório final deve demonstrar:

```text
matrículas_2025
= transitados
+ retidos
+ concluídos
+ transferidos/desistentes
+ pendentes_formais
```

E também:

```text
matrículas_2026
= rematrículas_confirmadas
+ novos_alunos_matriculados
```

Nenhuma diferença é aceitável sem lista nominal de exceções aprovada pela direção.

## 10. Plano de reversão

Antes da ativação:

- o ano 2026 permanece inativo;
- turmas e matrículas novas podem ser anuladas por lote identificado;
- nenhum registo de 2025 é sobrescrito;
- cada lote deve ter `run_id` e relatório de IDs criados.

Depois da ativação:

- desativar temporariamente 2026 somente mediante incidente confirmado;
- não eliminar matrículas, mensalidades ou pagamentos;
- corrigir por operações compensatórias auditadas;
- preservar logs e evidências para reconciliação.

## 11. Próxima decisão da escola

A reunião inicial precisa aprovar quatro pontos:

1. Receber e validar a planilha de resultados finais dos 559 alunos sem notas.
2. Definir percentuais ou valores do preçário reajustado por classe/curso.
3. Definir a política de rematrícula para os 341 alunos com dívida.
4. Identificar nominalmente os utilizadores que exercerão cada perfil aprovador.

Sem essas decisões, o KLASSE pode preparar o novo ano, mas não deve promover alunos nem ativar 2026/2027.

## 12. Preparação técnica implementada

O código está preparado para receber os dados finais sem bloquear a evolução do projeto:

- planilha `.xlsx`, `.xls` ou `.csv`;
- lançamento manual de linhas;
- integração por API usando o mesmo contrato;
- normalização de cabeçalhos em português;
- validação de notas entre 0 e 20;
- decisão final `TRANSITADO`, `RETIDO`, `CONCLUIDO` ou `PENDENTE`;
- preview sem mutação;
- detecção de duplicados e alunos sem correspondência;
- staging com checksum e idempotency key;
- preview de reajuste percentual;
- arredondamento configurável;
- valores manuais por tabela como override de última instância.

### Sequência de receção das notas

```text
Planilha / Manual / API
        ↓
Normalização de cabeçalhos e valores
        ↓
Preview e correspondência com aluno/matrícula
        ↓
Correção de rejeitados e duplicados
        ↓
Lote de staging VALIDADO
        ↓
Aprovação académica
        ↓
Aplicação oficial futura e reconciliação
```

O staging não escreve diretamente em `notas` ou `matriculas`. A aplicação oficial será uma fase separada, transacional e aprovada depois que a planilha real permitir mapear disciplinas, avaliações e períodos sem ambiguidade.

## 13. Estado operacional dos portais — Curtume — 2026-08-06

O ano letivo ativo da escola é `2026` (período escolar 2026/2027). O ano anterior `2025` está arquivado.

### Secretaria

- Pode receber e gerir candidaturas no backoffice.
- Pode criar/confirmar matrículas manualmente quando a candidatura for formal e houver turma do ano ativo.
- A conversão oficial usa `/api/secretaria/admissoes/convert`; a rota legada de confirmação de candidatura está encerrada.
- Pré-candidaturas não podem ser convertidas diretamente em matrícula.

### Portal público de candidaturas

No estado remoto atual, `modo_portal_admissoes = pre_candidatura_proximo_ano`, sem ano formal configurado. Portanto:

- o portal recebe pré-candidaturas;
- grava-as como `pre_candidatura`, sem ano letivo formal;
- não efetiva matrícula;
- candidaturas formais para 2026/2027 exigem abertura explícita do ano e do modo formal.

### Portal do aluno

O endpoint de rematrícula procura uma janela aberta para um ano superior ao ano atual. Não há janela aberta para o Curtume após a janela de 2025 já expirada. Logo, a rematrícula pelo portal ainda não está operacional.

### Próximo desbloqueio

Para fechar o fluxo ponta a ponta, a escola deve:

1. abrir candidatura formal para o ano ativo 2026, sem criar uma janela de rematrícula para 2026;
2. criar/preparar o ano destino 2027/2028 pelo wizard;
3. abrir a janela acoplada de candidaturas e rematrículas para 2027;
4. validar uma candidatura pública e uma rematrícula no portal do aluno antes de comunicar a abertura.

O endpoint de abertura do próximo ano rejeita explicitamente anos menores ou iguais ao ano ativo. Essa proteção evita que uma ação de “abrir inscrições e rematrículas” crie uma janela inválida para o ciclo corrente.

Quando o ano ativo estiver pronto, a UI pode sair diretamente de pré-candidatura para candidatura formal. A rematrícula continua reservada ao ano futuro: a API rejeita a ativação isolada de uma janela sem candidatura formal aberta para o mesmo ano.
