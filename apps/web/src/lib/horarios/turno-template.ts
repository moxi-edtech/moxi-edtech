export type TurnoTemplate = {inicio:string; aulas:number; minutos:number; pausaApos:number; pausaMinutos:number; intervaloEntre:number; dias:number[]; turno:string};
export function buildTurnoTemplate(config:TurnoTemplate) {
  const {inicio,aulas,minutos,pausaApos,pausaMinutos,intervaloEntre,dias,turno}=config;
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(inicio)||!["matinal","tarde","noite"].includes(turno)||!Number.isInteger(aulas)||aulas<1||aulas>16||!Number.isInteger(minutos)||minutos<15||minutos>120||!Number.isInteger(pausaMinutos)||pausaMinutos<0||pausaMinutos>120||!Number.isInteger(intervaloEntre)||intervaloEntre<0||intervaloEntre>30||!Number.isInteger(pausaApos)||pausaApos<0||pausaApos>=aulas||(pausaMinutos>0&&pausaApos===0)||!dias.length||new Set(dias).size!==dias.length||dias.some(d=>!Number.isInteger(d)||d<1||d>5))throw new Error("Verifique a duração, os dias e a posição do intervalo.");
  const [h,m]=inicio.split(":").map(Number);let cursor=h*60+m;
  const time=(n:number)=>{if(n>=1440)throw new Error("O turno termina depois da meia-noite.");return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")};
  const base:Array<{ordem:number;inicio:string;fim:string;is_intervalo:boolean}>=[];
  const add=(duration:number,is_intervalo:boolean)=>{base.push({ordem:base.length+1,inicio:time(cursor),fim:time(cursor+duration),is_intervalo});cursor+=duration};
  for(let i=1;i<=aulas;i++){
    add(minutos,false);
    if(i===aulas)break;
    if(i===pausaApos&&pausaMinutos>0)add(pausaMinutos,true);else cursor+=intervaloEntre;
  }
  return {preview:base,items:dias.flatMap(dia_semana=>base.map(row=>({...row,dia_semana,turno_id:turno})))};
}
