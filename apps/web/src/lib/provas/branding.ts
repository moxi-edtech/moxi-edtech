export const PROVA_FOOTER="Gerado pelo KLASSE · www.klasse.ao";
export const MAX_LOGO_BYTES=2*1024*1024;

/** Image-mode only, never inject raw SVG, HTML or remote URLs into the print document. */
export function safeLogoData(value:unknown):string|null{
 if(typeof value!=="string"||value.length>Math.ceil(MAX_LOGO_BYTES/3)*4+50)return null;
 return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:null;
}

/** Same institutional storage origin, exact school folder and no arbitrary URL. */
export function schoolLogoSource(value:unknown,escolaId:string,storageOrigins:readonly (string|undefined)[]):URL|null{
 if(typeof value!=="string"||!value.trim()||!/^[0-9a-f-]{36}$/i.test(escolaId))return null;
 try{
  const url=new URL(value.trim());
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)return null;
  const origins=storageOrigins.flatMap(origin=>{try{return origin?[new URL(origin).origin]:[];}catch{return [];}});
  if(!origins.includes(url.origin))return null;
  const prefix="/storage/v1/object/public/school-branding/escolas/"+escolaId+"/logo/";
  if(!url.pathname.startsWith(prefix)||!/^[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname.slice(prefix.length)))return null;
  return url;
 }catch{return null;}
}
