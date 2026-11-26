import { MAX_LOGO_BYTES,safeLogoData,schoolLogoSource } from "./branding";

const safeDimensions=(w:number,h:number)=>w>0&&h>0&&w<=8192&&h<=8192&&w*h<=16000000;
function jpegDimensions(b:Buffer){
 let i=2;
 while(i+3<b.length){
  if(b[i++]!==0xff)return false;
  while(i<b.length&&b[i]===0xff)i++;
  const marker=b[i++];
  if(marker===0xd9||marker===0xda||i+1>=b.length)return false;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  const length=b.readUInt16BE(i);
  if(length<2||i+length>b.length)return false;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   return length>=8&&safeDimensions(b.readUInt16BE(i+5),b.readUInt16BE(i+3));
  }
  i+=length;
 }
 return false;
}
function webpDimensions(b:Buffer){
 if(b.length<30)return false;
 const chunk=b.toString("ascii",12,16);
 if(chunk==="VP8X")return !(b[20]&2)&&safeDimensions(1+b.readUIntLE(24,3),1+b.readUIntLE(27,3));
 if(chunk==="VP8L"&&b[20]===0x2f){
  const bits=b.readUInt32LE(21);return safeDimensions(1+(bits&0x3fff),1+((bits>>>14)&0x3fff));
 }
 if(chunk==="VP8 "&&b[23]===0x9d&&b[24]===1&&b[25]===0x2a)return safeDimensions(b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff);
 return false;
}
function rasterType(bytes:Buffer){
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString("ascii",12,16)==="IHDR"){
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  return safeDimensions(w,h)?"png":null;
 }
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&jpegDimensions(bytes))return "jpeg";
 if(bytes.length>=16&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"&&webpDimensions(bytes))return "webp";
 return null;
}

/** Fetch once from the configured storage project. Fail open to name-only branding,
 * bounded read/time, no forwarding of credentials, no redirect/SSRF. */
export async function loadProvaLogo(value:unknown,escolaId:string,fetcher:typeof fetch=fetch,origins:readonly (string|undefined)[]=[process.env.SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_URL]):Promise<string|null>{
 const url=schoolLogoSource(value,escolaId,origins);
 if(!url)return null;
 try{
  const response=await fetcher(url,{cache:"force-cache",redirect:"error",credentials:"omit",signal:AbortSignal.timeout(6000)});
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
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(!type||mime!=="image/"+type&&mime!=="application/octet-stream")return null;
  return safeLogoData("data:image/"+type+";base64,"+bytes.toString("base64"));
 }catch{return null;}
}
