import { MAX_LOGO_BYTES,safeLogoData,schoolLogoSource } from "./branding";

function rasterType(bytes:Buffer){
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString("ascii",12,16)==="IHDR"){
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  return w>0&&h>0&&w*h<=16000000?"png":null;
 }
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "jpeg";
 if(bytes.length>=16&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "webp";
 return null;
}

/** Fetch once from the configured storage project. Fail open to name-only branding,
 * bounded read/time, no forwarding of credentials, no redirect/SSRF. */
export async function loadProvaLogo(value:unknown,escolaId:string,fetcher:typeof fetch=fetch,origins:readonly (string|undefined)[]=[process.env.SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_URL]):Promise<string|null>{
 const url=schoolLogoSource(value,escolaId,origins);
 if(!url)return null;
 try{
  const response=await fetcher(url,{cache:"no-store",redirect:"error",credentials:"omit",signal:AbortSignal.timeout(3000)});
  if(!response.ok||!response.body||Number(response.headers.get("content-length")??0)>MAX_LOGO_BYTES){await response.body?.cancel();return null;}
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];let size=0;
  try{
   while(true){
    const {done,value:chunk}=await reader.read();
    if(done)break;
    size+=chunk.byteLength;
    if(size>MAX_LOGO_BYTES){await reader.cancel();return null;}
    chunks.push(chunk);
   }
  }finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks,size);
  const type=rasterType(bytes);
  if(!type||response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="image/"+type)return null;
  return safeLogoData("data:image/"+type+";base64,"+bytes.toString("base64"));
 }catch{return null;}
}
