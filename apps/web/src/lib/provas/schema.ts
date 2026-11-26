import { z } from "zod";
import { richSchema,richText } from "./rich";
import { mathMarkup } from "./math";
import { APRESENTACOES } from "./layout";
export const TIPOS = ["grupo","texto","discursiva","verdadeiro_falso","lacunas","escolha","calculo","desenho","alinea"] as const;
export const blockSchema=z.object({tipo:z.enum(TIPOS),texto:z.string().trim().min(1).max(3000),linhas:z.number().int().min(0).max(20),rich:richSchema.optional(),alternativas:z.array(z.string().trim().min(1).max(500)).min(2).max(8).optional(),cotacao_cent:z.number().int().min(0).max(2000).optional()}).strict().superRefine((b,ctx)=>{
 if(b.alternativas!==undefined&&b.tipo!=="escolha")ctx.addIssue({code:z.ZodIssueCode.custom,message:"Alternativas apenas em escolha múltipla",path:["alternativas"]});
 if(b.cotacao_cent!==undefined&&["grupo","texto"].includes(b.tipo))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Cotação apenas em perguntas",path:["cotacao_cent"]});
 if(b.rich&&richText(b.rich)!==b.texto)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Conteúdo formatado inconsistente",path:["rich"]});
 if(b.rich?.segments.some(s=>s.kind==="math"&&!mathMarkup(s.latex)))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Expressão matemática inválida",path:["rich"]});
});
export const TIPOS_PROVA=["professor","trimestral","exame_final","recurso","extraordinario","segunda_chamada","diagnostica","simulado","outro"] as const;
export type TipoProva=typeof TIPOS_PROVA[number];
export const tiposProva:Record<TipoProva,string>={professor:"Prova do Professor",trimestral:"Prova Trimestral",exame_final:"Exame Final",recurso:"Exame de Recurso",extraordinario:"Exame Extraordinário",segunda_chamada:"Prova de Segunda Chamada",diagnostica:"Prova Diagnóstica",simulado:"Simulado",outro:"Outra prova"};
type TitleContext={tipo_prova?:TipoProva;titulo:string;disciplina:string};
/** Standard types derive their printed/display title from the academic snapshot. */
export function provaDisplayTitle(prova:TitleContext):string{
 const type=prova.tipo_prova?tiposProva[prova.tipo_prova]:null;
 const title=prova.titulo.trim();
 if(!type)return [title,prova.disciplina].filter(Boolean).join(" — ");
 const custom=prova.tipo_prova==="outro"&&title&&title!=="Prova"&&title!==type;
 return [custom?title:type,prova.disciplina].filter(Boolean).join(" de ");
}
export function provaSubtitle(prova:TitleContext):string|null{
 const type=prova.tipo_prova?tiposProva[prova.tipo_prova]:null;
 const title=prova.titulo.trim();
 return type&&prova.tipo_prova!=="outro"&&title&&title!=="Prova"&&title!==type&&title!==provaDisplayTitle(prova)?title:null;
}
/** Keep the stored title contract; a type change is explicit, not an implicit rewrite on load. */
export function tituloAoMudarTipo(previous:TitleContext,next:TipoProva):string{
 if(next===previous.tipo_prova)return previous.titulo;
 if(next==="outro")return "";
 return previous.tipo_prova!=="outro"&&provaSubtitle(previous)?previous.titulo:tiposProva[next];
}
export const provaSchema=z.object({
 tipo_prova:z.enum(TIPOS_PROVA).optional(),
 apresentacao:z.enum(APRESENTACOES).optional(),
 titulo:z.string().trim().min(1).max(160),classe:z.string().trim().min(1).max(80),disciplina:z.string().trim().min(1).max(120),
 ano_lectivo:z.string().regex(/^\d{4}\/\d{4}$/).refine(v=>[Number(v.slice(0,4)),Number(v.slice(0,4))+1].includes(Number(v.slice(5))),"Ano lectivo inválido"),
 trimestre:z.number().int().min(1).max(3),duracao:z.number().int().min(1).max(480),serie:z.string().trim().min(1).max(20),
 conteudo:z.array(blockSchema).min(1).max(80).refine(v=>v.reduce((n,b)=>n+(b.rich?.segments.filter(s=>s.kind==="math").length??0),0)<=80,"Até 80 fórmulas por prova")
}).strict();
export const provaWriteSchema=provaSchema.extend({tipo_prova:z.enum(TIPOS_PROVA).default("trimestral"),apresentacao:z.enum(APRESENTACOES).optional(),ano_letivo_id:z.string().uuid(),curso_matriz_id:z.string().uuid()});
export const mutationSchema=z.discriminatedUnion("acao",[
 z.object({acao:z.literal("criar"),dados:provaWriteSchema}).strict(),
 z.object({acao:z.literal("guardar"),id:z.string().uuid(),versao:z.number().int().positive(),dados:provaWriteSchema}).strict(),
 z.object({acao:z.enum(["submeter","aprovar","devolver","arquivar","duplicar"]),id:z.string().uuid(),versao:z.number().int().positive()}).strict()
]);
export type ProvaPrintInput=z.infer<typeof provaSchema>;
export type ProvaInput=z.infer<typeof provaWriteSchema>;
export type AnoProva={id:string;label:string;ativo:boolean};
export type ContextoProva={ano_letivo_id:string;curso_matriz_id:string;ano_lectivo:string;classe:string;disciplina:string;curso:string;trimestre:number;cotacao_max_cent:number|null};
export type Bloco=z.infer<typeof blockSchema>;
export type ProvaEstado="rascunho"|"em_revisao"|"aprovada"|"arquivada";
export type ProvaResumo=Omit<ProvaInput,"conteudo">&{id:string;autor_id:string|null;estado:ProvaEstado;versao:number;atualizado_em:string};
export type Prova=ProvaResumo&{conteudo:Bloco[]};
export const estados:Record<ProvaEstado,string>={rascunho:"Rascunho",em_revisao:"Em revisão",aprovada:"Aprovada",arquivada:"Arquivada"};
export const tipos:Record<Bloco["tipo"],string>={grupo:"Grupo",texto:"Texto de apoio",discursiva:"Pergunta discursiva",verdadeiro_falso:"Verdadeiro ou falso",lacunas:"Preencher lacunas",escolha:"Escolha múltipla",calculo:"Cálculo",desenho:"Desenho",alinea:"Alínea"};
