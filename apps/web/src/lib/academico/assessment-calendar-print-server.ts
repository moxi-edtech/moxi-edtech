import { randomUUID } from "node:crypto";
import { loadProvaLogo } from "../provas/loadLogo";
import { assessmentCalendarHtml,type AssessmentPrintRow } from "./assessment-calendar-print";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
export const assessmentPrintError=(message:string,status=400)=>new Response(message,{status,headers:{...headers,"Content-Type":"text/plain; charset=utf-8"}});
type IdRow={id:string};
type ClassRow={id:string;nome:string;classe_num:number|string|null};
type EventRow={id:string;turma_id:string;turma_disciplina_id:string;tipo:string;data:string;inicio:string;fim:string|null;estado:string};
const chunks=<T,>(rows:T[],n=50)=>Array.from({length:Math.ceil(rows.length/n)},(_,i)=>rows.slice(i*n,(i+1)*n));
const unique=(v:string[])=>[...new Set(v)];
// All database access is through the caller's authenticated client; no service role.
export async function printAssessmentCalendar(db:any,input:{escolaId:string;yearId:string;year:string;term:number|null;allowedClassIds?:string[];turma?:string;classe?:string;conference?:boolean}){
 const {escolaId,yearId,term}=input;
 const fields="id,nome,classe_num";
 let classes:ClassRow[]=[];
 if(input.allowedClassIds!==undefined){
   for(const ids of chunks(unique(input.allowedClassIds))) {
     const r=await db.from("turmas").select(fields).eq("escola_id",escolaId).eq("ano_letivo_id",yearId).in("id",ids);
     if(r.error)throw r.error;classes.push(...(r.data??[]));
   }
 }else{
   let q=db.from("turmas").select(fields,{count:"exact"}).eq("escola_id",escolaId).eq("ano_letivo_id",yearId).eq("session_id",yearId).eq("status_validacao","ativo");
   if(input.turma)q=q.eq("id",input.turma);
   if(input.classe!==undefined)q=q.eq("classe_num",input.classe);
   const r=await q.order("id").limit(500);
   if(r.error)throw r.error;if(r.count===null||r.count!==(r.data??[]).length)return assessmentPrintError("Seleccione uma turma ou classe: o documento excede o limite seguro.",409);
   classes=r.data??[];
 }
 if(!classes.length)return assessmentPrintError("Nenhuma turma autorizada nesta selecção.",404);
 if(classes.length>500)return assessmentPrintError("Demasiadas turmas. Reduza a selecção.",409);
 let periodIds:string[]|null=null;
 if(term!==null){
   const r=await db.from("periodos_letivos").select("id",{count:"exact"}).eq("escola_id",escolaId).eq("ano_letivo_id",yearId).eq("numero",term).limit(150);
   if(r.error)throw r.error;if(r.count!==(r.data??[]).length)return assessmentPrintError("Períodos incompletos.",409);
   periodIds=(r.data??[]).map((v:IdRow)=>v.id);
 }
 const events:EventRow[]=[];
 if(periodIds===null||periodIds.length){
   for(const ids of chunks(classes.map(c=>c.id))){
     for(let offset=0;;offset+=200){
       let q=db.from("calendario_avaliacoes").select("id,turma_id,turma_disciplina_id,tipo,data,inicio,fim,estado",{count:"exact"}).eq("escola_id",escolaId).eq("ano_letivo_id",yearId).in("turma_id",ids).in("estado",input.conference?["publicado","rascunho"]:["publicado"]);
       if(periodIds)q=q.in("periodo_letivo_id",periodIds);
       const r=await q.order("id").range(offset,offset+199);
       if(r.error)throw r.error;
       if(r.count===null||r.count>4000||r.count+events.length-offset>4000)return assessmentPrintError("Demasiadas avaliações. Imprima por turma ou trimestre.",409);
       const part=(r.data??[]) as EventRow[];
       if(part.length!==Math.min(200,Math.max(0,r.count-offset)))return assessmentPrintError("Não foi possível confirmar a lista completa de avaliações.",409);
       events.push(...part);if(offset+part.length>=r.count)break;
     }
   }
 }
 const assignments=new Map<string,string>();const matrix=new Map<string,string>();const subjects=new Map<string,string>();
 for(const ids of chunks(unique(events.map(e=>e.turma_disciplina_id)))){
   const r=await db.from("turma_disciplinas").select("id,curso_matriz_id").eq("escola_id",escolaId).in("id",ids);
   if(r.error)throw r.error;for(const x of r.data??[])assignments.set(x.id,x.curso_matriz_id);
 }
 for(const ids of chunks(unique([...assignments.values()]))){
   const r=await db.from("curso_matriz").select("id,disciplina_id").eq("escola_id",escolaId).in("id",ids);
   if(r.error)throw r.error;for(const x of r.data??[])matrix.set(x.id,x.disciplina_id);
 }
 for(const ids of chunks(unique([...matrix.values()]))){
   const r=await db.from("disciplinas_catalogo").select("id,nome").eq("escola_id",escolaId).in("id",ids);
   if(r.error)throw r.error;for(const x of r.data??[])subjects.set(x.id,x.nome);
 }
 const names=new Map(classes.map(c=>[c.id,c.nome]));
 const rows:AssessmentPrintRow[]=[];
 for(const e of events){
   const turma=names.get(e.turma_id),disciplina=subjects.get(matrix.get(assignments.get(e.turma_disciplina_id)??"")??"");
   if(!turma||!disciplina)return assessmentPrintError("Não foi possível confirmar os nomes das turmas e disciplinas.",409);
   rows.push({turmaId:e.turma_id,turma,disciplina,tipo:e.tipo,data:e.data,inicio:e.inicio,fim:e.fim,estado:e.estado});
 }
 const school=await db.from("escolas").select("nome,logo_url").eq("id",escolaId).maybeSingle();
 if(school.error||!school.data)return assessmentPrintError("Identidade da escola indisponível.",409);
 const nonce=randomUUID(),logo=await loadProvaLogo(school.data.logo_url,escolaId);
 return new Response(assessmentCalendarHtml({school:school.data.nome,year:input.year,term,rows,logo,conference:input.conference,nonce}),{headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
export function parseAssessmentPrintTerm(q:URLSearchParams):number|null|undefined{
 const v=q.get("trimestre");return v===null?null:["1","2","3"].includes(v)?Number(v):undefined;
}
