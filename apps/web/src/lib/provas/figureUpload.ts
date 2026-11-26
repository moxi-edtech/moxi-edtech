import { FIGURE_MAX_CHARS,FIGURE_MAX_DIMENSION,safeProvaFigure,type ProvaFigure } from "./figures";

// Decode locally and re-encode to PNG: no network fetch, vector markup or original metadata.
export async function prepareProvaFigure(file:File,alt:string):Promise<ProvaFigure>{
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024||file.size===0)throw new Error("Seleccione PNG, JPEG ou WebP até 5 MB.");
 const url=URL.createObjectURL(file);
 const image=new Image();
 try{
  image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>24000000)throw new Error("Dimensões da imagem demasiado grandes.");
  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar a imagem.");
  const ratio=Math.min(1,FIGURE_MAX_DIMENSION/Math.max(image.naturalWidth,image.naturalHeight));
  for(let scale=ratio;scale>=ratio*0.2;scale*=0.8){
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const src=canvas.toDataURL("image/png");
   if(src.length<=FIGURE_MAX_CHARS){const f=safeProvaFigure({src,alt});if(f)return f;}
  }
  throw new Error("A imagem excede o limite após optimização. Recorte-a e tente novamente.");
 }finally{URL.revokeObjectURL(url);}
}
