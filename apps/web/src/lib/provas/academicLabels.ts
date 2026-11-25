import { formatTurmaDisplayName, formatTurnoDisplay } from "../../utils/formatters";

/** Only normalize a numeric class label; custom school names remain intact. */
export function formatClasseProva(value?: string|null):string {
 const name=(value??"").trim().replace(/\s+/g," ");
 const numeric=/^([1-9]\d?)\s*\.?\s*[ªº°]?\s*(?:classe)?$/i.exec(name);
 return numeric?numeric[1]+".ª Classe":name;
}

type TurmaContext={nome?:string|null;letra?:string|null;turno?:string|null;curso?:string|null};
const compactDesignation=(value:string)=>/^[\p{L}\p{N}]{1,8}$/u.test(value);

/** Never infer the approved class from a turma code. Letter and shift are
 * structured fields; the shared legacy formatter is only a fallback. */
export function turmaProvaLabels(classe:string,turma:TurmaContext){
 const classLabel=formatClasseProva(classe);
 const raw=(turma.nome??"").trim();
 const letter=(turma.letra??"").trim();
 const turno=formatTurnoDisplay(turma.turno);
 const curso=(turma.curso??"").trim();
 let designation="";
 if(letter&&compactDesignation(letter))designation="Turma "+letter;
 else if(raw){
  const short=/^(?:\d{1,2}\s*\.?\s*[ªº°]\s*(?:classe\s*)?[-–— ]*\s*|turma\s+)([\p{L}\p{N}]{1,4})$/iu.exec(raw);
  const formatted=formatTurmaDisplayName({nome:raw,turno:turma.turno});
  const legacy=/ — Turma ([\p{L}\p{N}]{1,8})(?: \([^)]*\))?$/u.exec(formatted);
  if(short&&short[1].toLowerCase()!=="classe")designation="Turma "+short[1];
  else if(legacy)designation="Turma "+legacy[1];
  else if(compactDesignation(raw)&&/^[A-Z0-9]{1,2}$/.test(raw))designation="Turma "+raw;
  else if(!/^[A-Z0-9]{2,6}[-_/]/.test(raw)&&!(/^[A-Z0-9_-]+$/.test(raw)&&raw.length>2)&&raw!==classLabel&&formatClasseProva(raw)!==classLabel){
   // Preserve explicit custom human-readable names instead of fabricating letters.
   designation=/^turma\s+/i.test(raw)?raw:"Turma "+raw;
  }
 }
 const turmaLabel=designation||"Turma sem designação";
 const label=[curso,classLabel,turmaLabel].filter(Boolean).join(" — ")+(turno?" ("+turno+")":"");
 return {classe:classLabel,turma:turmaLabel,turno,curso,label};
}
