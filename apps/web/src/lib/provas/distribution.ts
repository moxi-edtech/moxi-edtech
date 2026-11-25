import { z } from "zod";
export const PROVA_BATCH=40;
export const MAX_PROVA_TURMAS=10;
export const PROVA_BATCH_SIZES=[40,20,10,5,1] as const;
export const turmaSchema=z.object({id:z.string().uuid(),nome:z.string().nullable(),turno:z.string().nullable(),sala:z.string().nullable(),total:z.number().int().nonnegative()});
export const recipientSchema=z.object({matricula_id:z.string().uuid(),turma_id:z.string().uuid(),turma:z.string().nullable(),turno:z.string().nullable(),sala:z.string().nullable(),nome:z.string(),numero_processo:z.string().nullable(),numero_chamada:z.number().int().nullable()});
export type PrintRecipient=z.infer<typeof recipientSchema>;
export type PrintTurma=z.infer<typeof turmaSchema>;
export const distributionResult=z.object({items:z.array(z.unknown()),total:z.number().int().nonnegative(),offset:z.number().int().nonnegative(),limit:z.number().int().refine(n=>PROVA_BATCH_SIZES.some(size=>size===n)),snapshot:z.string().regex(/^[a-f0-9]{32}$/)});
export const distributionQuery=z.object({
 prova:z.string().uuid(),versao:z.coerce.number().int().positive(),modo:z.enum(["turmas","alunos","imprimir"]),
 turmas:z.string().transform(s=>s?s.split(","):[]).pipe(z.array(z.string().uuid()).max(MAX_PROVA_TURMAS).refine(v=>new Set(v).size===v.length)),
 matricula:z.string().uuid().nullable(),offset:z.coerce.number().int().min(0).max(10000),limit:z.coerce.number().int().refine(n=>PROVA_BATCH_SIZES.some(size=>size===n)),
}).strict().superRefine((v,ctx)=>{
 const ok=v.modo==="turmas"?v.turmas.length===0&&!v.matricula&&!v.offset:v.modo==="alunos"?v.turmas.length===1&&!v.matricula&&!v.offset:v.turmas.length>0&&(!v.matricula||(v.turmas.length===1&&!v.offset));
 if(!ok)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Selecção inválida."});
});
export function parseDistribution(q:URLSearchParams){
 return distributionQuery.safeParse({prova:q.get("prova"),versao:q.get("versao"),modo:q.get("modo"),turmas:q.get("turmas")??"",matricula:q.get("matricula"),offset:q.get("offset")??"0",limit:q.get("limit")??String(PROVA_BATCH)});
}
export function distributionError(error:{code?:string;message?:string}){
 if(error.code==="42501")return {status:403,message:"Prova ou destinatário não autorizado."};
 if(error.code==="40001")return {status:409,message:"A prova mudou. Reabra a versão aprovada."};
 if(error.code==="22023")return {status:409,message:error.message==="duplicate_active_enrollment"?"Existem matrículas activas duplicadas. Regularize antes de imprimir.":error.message==="no_eligible_students"?"Nenhum aluno elegível para esta selecção.":"Selecção indisponível ou acima do limite."};
 return {status:500,message:"Não foi possível consultar os destinatários."};
}
export function rpcArgs(escola:string,d:z.infer<typeof distributionQuery>){
 return {p_escola:escola,p_prova:d.prova,p_versao:d.versao,p_modo:d.modo,p_turmas:d.turmas,p_matricula:d.matricula,p_offset:d.offset,p_limit:d.limit};
}
