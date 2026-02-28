// apps/web/src/lib/super-admin/escola-saude-utils.ts

/**
 * Funções puras para cálculo de saúde e geração de alertas de escolas.
 * Este ficheiro pode ser importado por Client Components.
 */

export function calcularSaudeEscola(escola: any): number {
  if (!escola) return 0;
  
  let score = 100;
  
  // 1. Recência de acesso (Inactividade penaliza)
  if (escola.ultimo_acesso) {
    const diasInativo = (Date.now() - new Date(escola.ultimo_acesso).getTime()) / (1000 * 60 * 60 * 24);
    if (diasInativo > 7) score -= 40;
    else if (diasInativo > 3) score -= 20;
  } else {
    score -= 50;
  }
  
  // 2. Volume de dados (Escolas vazias têm score menor)
  if (Number(escola.alunos_ativos ?? 0) === 0) score -= 10;
  if (Number(escola.turmas_total ?? 0) === 0) score -= 10;
  
  // 3. Status de sincronização (se disponível)
  if (escola.sync_status && escola.sync_status !== 'synced') {
    score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function gerarAlertasEscola(escola: any): any[] {
  const alertas: any[] = [];
  if (!escola) return alertas;

  // Alerta de Inactividade
  if (escola.ultimo_acesso) {
    const diasInativo = (Date.now() - new Date(escola.ultimo_acesso).getTime()) / (1000 * 60 * 60 * 24);
    if (diasInativo > 3) {
      alertas.push({
        id: `inativo-${escola.id}`,
        tipo: diasInativo > 7 ? 'critical' : 'warning',
        titulo: 'Inactividade Detectada',
        mensagem: `A escola não acede ao sistema há ${Math.floor(diasInativo)} dias.`,
        data: new Date().toISOString()
      });
    }
  }

  // Alerta de Dados Faltantes
  if (Number(escola.alunos_ativos ?? 0) === 0) {
    alertas.push({
      id: `sem-alunos-${escola.id}`,
      tipo: 'info',
      titulo: 'Configuração Pendente',
      mensagem: 'A escola ainda não registou alunos activos.',
      data: new Date().toISOString()
    });
  }

  return alertas;
}
