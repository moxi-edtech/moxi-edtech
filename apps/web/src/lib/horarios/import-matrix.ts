export const TIMETABLE_DAYS=["Segunda","Terça","Quarta","Quinta","Sexta"] as const;
export type ImportSlot={id:string;dia_semana:number;ordem:number;inicio:string;fim:string;is_intervalo?:boolean|null};
export type ImportDiscipline={id:string;disciplina:string};
const normalize=(value:unknown)=>String(value??"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ");
const hhmm=(value:string)=>value.slice(0,5);
const timeKey=(start:string,end:string)=>hhmm(start)+"-"+hhmm(end);

export function buildImportTemplate(slots:ImportSlot[]){
  const times=[...new Set(slots.filter(s=>!s.is_intervalo&&s.dia_semana>=1&&s.dia_semana<=5).map(s=>timeKey(s.inicio,s.fim)))].sort();
  return [["Horário",...TIMETABLE_DAYS],...times.map(time=>[time,"","","","",""])];
}

// Exact normalized name match; never guess an ambiguous subject or a time.
export function parseTimetableMatrix(rows:unknown[][],slots:ImportSlot[],disciplines:ImportDiscipline[]){
  const errors:string[]=[];const grid:Record<string,string|null>={};
  const headerIndex=rows.findIndex(r=>["horario","tempo"].includes(normalize(r[0]))&&TIMETABLE_DAYS.every((day,i)=>normalize(r[i+1]).replace(/-feira$/,"")===normalize(day)));
  if(headerIndex<0)return {grid,errors:["Cabeçalho esperado: Horário, Segunda, Terça, Quarta, Quinta, Sexta."],count:0};
  const byName=new Map<string,ImportDiscipline[]>();
  for(const d of disciplines){const key=normalize(d.disciplina);byName.set(key,[...(byName.get(key)||[]),d]);}
  for(let i=headerIndex+1;i<rows.length;i++){
    const row=rows[i]||[];
    if(row.every(c=>!normalize(c)))continue;
    if(row.slice(6).some(c=>normalize(c))){errors.push("Linha "+(i+1)+": existem colunas adicionais preenchidas.");continue;}
    const range=String(row[0]??"").trim().match(/^(\d{1,2}):(\d{2})(?::00)?\s*[-–—]\s*(\d{1,2}):(\d{2})(?::00)?$/);
    if(!range){errors.push("Linha "+(i+1)+": indique início e fim do tempo.");continue;}
    const key=range[1].padStart(2,"0")+":"+range[2]+"-"+range[3].padStart(2,"0")+":"+range[4];
    for(let d=1;d<=5;d++){
      const name=normalize(row[d]);if(!name||["*","-","livre","tempo livre","intervalo","recreio"].includes(name))continue;
      const day=TIMETABLE_DAYS[d-1];
      const possible=slots.filter(s=>!s.is_intervalo&&s.dia_semana===d&&timeKey(s.inicio,s.fim)===key);
      const subjects=byName.get(name)||[];
      const context="Linha "+(i+1)+" · "+day;
      if(possible.length!==1){errors.push(context+": tempo não encontrado ou ambíguo.");continue;}
      if(subjects.length!==1){errors.push(context+": disciplina não encontrada ou ambígua: "+String(row[d]).trim());continue;}
      const cell=day+"-"+possible[0]!.ordem;
      if(Object.prototype.hasOwnProperty.call(grid,cell)){errors.push(context+": tempo duplicado.");continue;}
      grid[cell]=subjects[0]!.id;
    }
  }
  return {grid,errors,count:Object.keys(grid).length};
}
