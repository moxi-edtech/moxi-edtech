import type { EscolaAlerta } from '@/app/super-admin/health/types';

const ONE_HOUR_MS = 1000 * 60 * 60;

export function calcularHorasDesdeLogin(ultimoAcesso: string | null | undefined) {
  if (!ultimoAcesso) return null;
  const ultimo = new Date(ultimoAcesso).getTime();
  if (Number.isNaN(ultimo)) return null;
  return (Date.now() - ultimo) / ONE_HOUR_MS;
}

export function calcularSaudeEscola(escola: {
  alunos_ativos: number;
  onboarding_pct: number | null;
  ultimo_acesso: string | null;
  sync_status: 'synced' | 'pending' | 'error' | string | null;
}): number {
  const onboarding = escola.onboarding_pct ?? 0;
  const horasDesdeLogin = calcularHorasDesdeLogin(escola.ultimo_acesso) ?? 9999;

  const pontos = [
    escola.alunos_ativos > 0 ? 25 : 0,
    onboarding >= 100 ? 25 : Math.round(onboarding / 4),
    horasDesdeLogin < 48 ? 25 : horasDesdeLogin < 168 ? 12 : 0,
    escola.sync_status === 'synced' ? 25 : 0,
  ];

  return pontos.reduce((a, b) => a + b, 0);
}

export function gerarAlertasEscola(escola: {
  saude: number;
  dias_renovacao: number | null;
  alunos_ativos: number;
  ultimo_acesso: string | null;
  sync_status: string | null;
}): EscolaAlerta[] {
  const alertas: EscolaAlerta[] = [];
  const horasDesdeLogin = calcularHorasDesdeLogin(escola.ultimo_acesso) ?? 0;

  if (escola.sync_status === 'error') {
    alertas.push({ tipo: 'critico', msg: 'Erro de sincronização' });
  }

  if (escola.alunos_ativos === 0) {
    alertas.push({ tipo: 'critico', msg: 'Sem alunos importados' });
  }

  if (horasDesdeLogin > 72) {
    alertas.push({
      tipo: 'aviso',
      msg: `Sem actividade há ${Math.round(horasDesdeLogin / 24)}d`,
    });
  }

  if (escola.dias_renovacao !== null && escola.dias_renovacao < 15) {
    alertas.push({ tipo: 'aviso', msg: `Renovação em ${escola.dias_renovacao}d` });
  }

  if (!alertas.length && escola.saude >= 85) {
    alertas.push({ tipo: 'info', msg: 'Saúde em dia' });
  }

  return alertas;
}
