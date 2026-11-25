import { z } from "zod";
import { richSchema,richText } from "./rich";
import { mathMarkup } from "./math";
export const TIPOS = ["grupo","texto","discursiva","verdadeiro_falso","lacunas","escolha","calculo","desenho","alinea"] as const;
export const blockSchema=z.object({tipo:z.enum(TIPOS),texto:z.string().trim().min(1).max(3000),linhas:z.number().int().min(0).max(20),rich:richSchema.optional()}).strict().superRefine((b,ctx)=>{
 if(b.rich&&richText(b.rich)!==b.texto)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Conteúdo formatado inconsistente",path:["rich"]});
 if(b.rich?.segments.some(s=>s.kind==="math"&&!mathMarkup(s.latex)))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Expressão matemática inválida",path:["rich"]});
});
export const provaSchema=z.object({
 titulo:z.string().trim().min(1).max(160),classe:z.string().trim().min(1).max(80),disciplina:z.string().trim().min(1).max(120),
 ano_lectivo:z.string().regex(/^\d{4}\/\d{4}$/).refine(v=>Number(v.slice(5))===Number(v.slice(0,4))+1,"Ano lectivo inválido"),
 trimestre:z.number().int().min(1).max(3),duracao:z.number().int().min(1).max(480),serie:z.string().trim().min(1).max(20),
 conteudo:z.array(blockSchema).min(1).max(80).refine(v=>v.reduce((n,b)=>n+(b.rich?.segments.filter(s=>s.kind==="math").length??0),0)<=80,"Até 80 fórmulas por prova")
}).strict();
export const mutationSchema=z.discriminatedUnion("acao",[
 z.object({acao:z.literal("criar"),dados:provaSchema}).strict(),
 z.object({acao:z.literal("guardar"),id:z.string().uuid(),versao:z.number().int().positive(),dados:provaSchema}).strict(),
 z.object({acao:z.enum(["submeter","aprovar","devolver","arquivar","duplicar"]),id:z.string().uuid(),versao:z.number().int().positive()}).strict()
]);
export type ProvaInput=z.infer<typeof provaSchema>;
export type Bloco=z.infer<typeof blockSchema>;
export type ProvaEstado="rascunho"|"em_revisao"|"aprovada"|"arquivada";
export type ProvaResumo=Omit<ProvaInput,"conteudo">&{id:string;autor_id:string;estado:ProvaEstado;versao:number;atualizado_em:string};
export type Prova=ProvaResumo&{conteudo:Bloco[]};
export const estados:Record<ProvaEstado,string>={rascunho:"Rascunho",em_revisao:"Em revisão",aprovada:"Aprovada",arquivada:"Arquivada"};
export const tipos:Record<Bloco["tipo"],string>={grupo:"Grupo",texto:"Texto de apoio",discursiva:"Pergunta discursiva",verdadeiro_falso:"Verdadeiro ou falso",lacunas:"Preencher lacunas",escolha:"Escolha múltipla",calculo:"Cálculo",desenho:"Desenho",alinea:"Alínea"};
