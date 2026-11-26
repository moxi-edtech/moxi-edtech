// Small, immutable raster figures belong to the private exam row (existing RLS).
// No external URLs, SVG, scripts or independent public asset endpoint.
export const FIGURE_MAX_CHARS=160000;
export const FIGURE_MAX_DIMENSION=1200;
export const FIGURE_MAX_PER_BLOCK=6;
export const FIGURE_MAX_PER_EXAM=24;
export const EXAM_CONTENT_MAX_BYTES=900000;
export const EXAM_REQUEST_MAX_BYTES=950000;
export type ProvaFigure={src:string;alt:string};
const PREFIX="data:image/png;base64,";
export function figureDimensions(src:unknown):{width:number;height:number}|null{
 if(typeof src!=="string"||src.length>FIGURE_MAX_CHARS||!src.startsWith(PREFIX))return null;
 const payload=src.slice(PREFIX.length);
 if(payload.length<44||payload.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return null;
 try{
  const head=atob(payload.slice(0,44));
  const tail=payload.slice(-4);
  if(btoa(atob(tail))!==tail)return null;
  const expected=[137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];
  if(expected.some((n,i)=>head.charCodeAt(i)!==n))return null;
  const u32=(i:number)=>head.charCodeAt(i)*16777216+head.charCodeAt(i+1)*65536+head.charCodeAt(i+2)*256+head.charCodeAt(i+3);
  const width=u32(16),height=u32(20);
  return width>=1&&width<=FIGURE_MAX_DIMENSION&&height>=1&&height<=FIGURE_MAX_DIMENSION?{width,height}:null;
 }catch{return null;}
}
export function safeProvaFigure(value:unknown):ProvaFigure|null{
 if(!value||typeof value!=="object")return null;
 const f=value as Record<string,unknown>;
 if(Object.keys(f).length!==2||typeof f.src!=="string"||typeof f.alt!=="string"||!f.alt.trim()||f.alt.trim().length>160||!figureDimensions(f.src))return null;
 return {src:f.src,alt:f.alt.trim()};
}
export function figureCount(blocks:readonly {figuras?:readonly ProvaFigure[]}[]){return blocks.reduce((n,b)=>n+(b.figuras?.length??0),0);}
export function contentFits(blocks:readonly {figuras?:readonly ProvaFigure[]}[]){
 return figureCount(blocks)<=FIGURE_MAX_PER_EXAM&&new TextEncoder().encode(JSON.stringify(blocks)).byteLength<=EXAM_CONTENT_MAX_BYTES-4096;
}
