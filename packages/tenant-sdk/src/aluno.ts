import { z } from 'zod';

export const AlunoStatusSchema = z.enum([
  'ativo',
  'inativo',
  'suspenso',
  'pendente',
  'trancado',
  'concluido',
  'transferido',
  'desistente',
]);

export type AlunoStatus = z.infer<typeof AlunoStatusSchema>;
