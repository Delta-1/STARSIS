import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export function inspectWebp(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<20||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)return null;
 let width=0,height=0,animated=false,hasImage=false;
 for(let pos=12;pos+8<=bytes.length;){
  const kind=bytes.toString('ascii',pos,pos+4),length=bytes.readUInt32LE(pos+4),start=pos+8,end=start+length;
  if(end>bytes.length)return null;
  if(kind==='VP8X'&&length>=10){animated=!!(bytes[start]&2);width=1+bytes.readUIntLE(start+4,3);height=1+bytes.readUIntLE(start+7,3);}
  if(kind==='VP8 '&&length>=10){hasImage=true;if(!width&&bytes.toString('hex',start+3,start+6)==='9d012a'){width=bytes.readUInt16LE(start+6)&16383;height=bytes.readUInt16LE(start+8)&16383;}}
  if(kind==='VP8L'&&length>=5){hasImage=true;const bits=bytes.readUInt32LE(start+1);if(!width){width=1+(bits&16383);height=1+((bits>>>14)&16383);}}
  if(kind==='ANMF')hasImage=true;
  pos=end+(length%2);
 }
 return hasImage&&width&&height?{width,height,animated}:null;
}
const convert=(bin,args)=>new Promise((resolve,reject)=>{const child=spawn(bin,args,{stdio:['ignore','ignore','pipe'],timeout:30000,killSignal:'SIGKILL'});child.stderr.resume();child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Não foi possível converter esta imagem em figurinha.')));});
export async function prepareSticker(bytes,binary){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>5*1024*1024)throw Error('Escolha uma imagem de até 5 MB.');
 const info=inspectWebp(bytes);
 if(info&&info.width===512&&info.height===512&&bytes.length<=(info.animated?500:100)*1024)return {sticker:bytes,mimetype:'image/webp',isAnimated:info.animated};
 if(info?.animated)throw Error('A figurinha animada deve ter 512 × 512 pixels e até 500 KB.');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!info&&!png&&!jpeg)throw Error('Use uma imagem PNG, JPEG ou WebP.');
 const dir=await mkdtemp(join(tmpdir(),'starsis-sticker-'));
 try{
  const input=join(dir,'input'),output=join(dir,'sticker.webp');await writeFile(input,bytes);
  for(const quality of [75,50,30,15]){
   await convert(binary,['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,'-frames:v','1','-vf',"scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",'-c:v','libwebp','-quality',String(quality),'-compression_level','6',output]);
   const sticker=await readFile(output),ready=inspectWebp(sticker);
   if(ready?.width===512&&ready.height===512&&sticker.length<=100*1024)return {sticker,mimetype:'image/webp',isAnimated:false};
  }
  throw Error('Esta imagem é muito detalhada. Escolha uma imagem menor para a figurinha.');
 }finally{await rm(dir,{recursive:true,force:true});}
}
