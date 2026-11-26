"use client";
import {useState} from "react";
import { Button } from "@/components/ui/Button";
import {FileSpreadsheet, Download, Upload, Check} from "lucide-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {buildImportTemplate,parseTimetableMatrix,type ImportSlot,type ImportDiscipline} from "@/lib/horarios/import-matrix";
type Sheet={name:string;rows:unknown[][];unsupported?:boolean};
export function ImportHorarioDialog({open,onClose,onApply,slots,disciplines}:{
  open:boolean;onClose:()=>void;onApply:(grid:Record<string,string|null>)=>void;slots:ImportSlot[];disciplines:ImportDiscipline[];
}){
  const [sheets,setSheets]=useState<Sheet[]>([]);
  const [sheet,setSheet]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const selected=sheets.find(s=>s.name===sheet);
  const result=selected?selected.unsupported?{grid:{},count:0,errors:["Esta folha contém fórmulas, células mescladas ou excede o limite de linhas/colunas. Utilize o modelo."]}:parseTimetableMatrix(selected.rows,slots,disciplines):null;
  const readFile=async(file:File)=>{
    setLoading(true);setError(null);setSheets([]);setSheet("");
    try{
      if(!file.name.toLowerCase().endsWith(".xlsx")||file.size>2*1024*1024)throw new Error("Seleccione um ficheiro XLSX até 2 MB.");
      const xlsx=await import("xlsx");
      const workbook=xlsx.read(await file.arrayBuffer(),{type:"array",sheetRows:100,cellFormula:true});
      if(workbook.SheetNames.length>20)throw new Error("O ficheiro tem demasiadas folhas.");
      const parsed=workbook.SheetNames.map(name=>{
        const ws=workbook.Sheets[name]!;
        const range=xlsx.utils.decode_range(ws["!fullref"]||ws["!ref"]||"A1:A1");
        const unsupported=range.e.r>=100||range.e.c>=30||!!ws["!merges"]?.length||Object.entries(ws).some(([key,value])=>!key.startsWith("!")&&Boolean((value as {f?:string})?.f));
        return {name,unsupported,rows:unsupported?[]:xlsx.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:false,defval:"",blankrows:true})};
      });
      setSheets(parsed);setSheet(parsed[0]?.name||"");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao ler o Excel.");}finally{setLoading(false);}
  };
  const download=async()=>{
    setError(null);
    try{
      const xlsx=await import("xlsx");const workbook=xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook,xlsx.utils.aoa_to_sheet(buildImportTemplate(slots)),"Horário");
      xlsx.utils.book_append_sheet(workbook,xlsx.utils.aoa_to_sheet([["Disciplinas da turma"],...disciplines.map(d=>[d.disciplina])]),"Disciplinas");
      xlsx.writeFile(workbook,"Modelo-horario.xlsx");
    }catch{setError("Não foi possível gerar o modelo.");}
  };
  return <Dialog open={open} onOpenChange={v=>{if(!v&&!loading)onClose()}}><DialogContent className="max-w-2xl rounded-xl">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet size={20}/> Importar horário Excel</DialogTitle><DialogDescription>Importe a grelha semanal da turma. A correspondência de tempos e disciplinas é verificada antes de alterar o rascunho.</DialogDescription></DialogHeader>
    <button type="button" onClick={()=>void download()} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><Download size={16}/> Baixar modelo da turma</button>
    <label className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm"><Upload size={16}/> <input type="file" accept=".xlsx" disabled={loading} onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file)}} className="w-full"/></label>
    {loading&&<p role="status" className="text-sm">A ler o ficheiro…</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {sheets.length>0&&<label className="text-sm">Folha a importar<select value={sheet} onChange={e=>setSheet(e.target.value)} className="mt-1 block w-full rounded-xl border border-border bg-card p-2">{sheets.map(s=><option key={s.name}>{s.name}</option>)}</select></label>}
    {result&&<div className="max-h-60 overflow-auto rounded-xl border border-border p-3 text-sm">
      <p className="font-semibold">{result.count} aulas identificadas</p>
      {result.errors.length>0?<><p className="text-red-700">{result.errors.length} problema(s) — corrija o ficheiro antes de continuar.</p>{result.errors.slice(0,30).map((e,i)=><p key={i} className="text-red-700">{e}</p>)}</>:<p className="text-muted-foreground">A importação substituirá apenas a distribuição em edição. Professores e salas não serão importados; pode desfazer antes de guardar.</p>}
      {!result.errors.length&&Object.entries(result.grid).map(([key,id])=><div key={key} className="flex justify-between border-b border-border py-1"><span>{key}</span><span>{disciplines.find(d=>d.id===id)?.disciplina}</span></div>)}
    </div>}
    <DialogFooter><button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-border px-3 py-2 text-sm">Cancelar</button><Button type="button" tone="gold" disabled={loading||!result?.count||!!result.errors.length} onClick={()=>{if(result?.count&&!result.errors.length){onApply(result.grid);onClose()}}} className="gap-2"><Check size={16}/> Aplicar ao rascunho</Button></DialogFooter>
  </DialogContent></Dialog>
}
