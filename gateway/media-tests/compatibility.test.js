import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createDecipheriv,createHash} from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
import pino from 'pino';
import {generateWAMessageContent,getMediaKeys} from 'baileys';
import {audioProbeWav,prepareVoiceAudio} from '../voice-audio.js';
import {inspectOpusOgg} from '../ogg.js';
import {inspectWebp,prepareSticker} from '../stickers.js';
const exec=promisify(execFile);
test('WebM/Opus and Safari AAC recordings become complete decodable WhatsApp voice notes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'starsis-media-test-'));
 try{
  const wav=join(dir,'test.wav');await writeFile(wav,audioProbeWav());
  for(const [ext,codec]of [['webm','libopus'],['m4a','aac']]){
   const source=join(dir,'browser.'+ext);await exec(ffmpeg,['-y','-i',wav,'-c:a',codec,source]);
   const voice=await prepareVoiceAudio(await readFile(source),ffmpeg);assert.equal(voice.ptt,true);assert.equal(voice.mimetype,'audio/ogg; codecs=opus');assert.equal(voice.waveform.length,64);assert.ok(voice.waveform.some(v=>v>0));assert.ok(inspectOpusOgg(voice.audio).duration>0.1);
   const broken=Buffer.from(voice.audio);broken[broken.length-1]^=1;assert.throws(()=>inspectOpusOgg(broken));assert.throws(()=>inspectOpusOgg(voice.audio.subarray(0,-1)));
   let encrypted;
   const message=await generateWAMessageContent(voice,{logger:pino({level:'silent'}),upload:async path=>{encrypted=await readFile(path);return {mediaUrl:'https://mmg.whatsapp.net/offline-fixture',directPath:'/offline-fixture'};}});
   const audio=message.audioMessage;assert.equal(audio.ptt,true);assert.equal(audio.mimetype,voice.mimetype);assert.equal(Number(audio.fileLength),voice.audio.length);
   assert.deepEqual(createHash('sha256').update(encrypted).digest(),Buffer.from(audio.fileEncSha256));
   const {cipherKey,iv}=await getMediaKeys(audio.mediaKey,'audio'),decipher=createDecipheriv('aes-256-cbc',cipherKey,iv);
   const decrypted=Buffer.concat([decipher.update(encrypted.subarray(0,-10)),decipher.final()]);assert.deepEqual(decrypted,voice.audio);inspectOpusOgg(decrypted);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('images become 512px WebP stickers and saved stickers preserve exact bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'starsis-sticker-test-'));
 try{const png=join(dir,'test.png');await exec(ffmpeg,['-y','-f','lavfi','-i','color=c=orange:s=128x96','-frames:v','1',png]);const result=await prepareSticker(await readFile(png),ffmpeg);assert.deepEqual(inspectWebp(result.sticker),{width:512,height:512,animated:false});assert.ok(result.sticker.length<=100*1024);assert.deepEqual((await prepareSticker(result.sticker,ffmpeg)).sticker,result.sticker);await assert.rejects(prepareSticker(Buffer.from('not an image'),ffmpeg));}
 finally{await rm(dir,{recursive:true,force:true});}
});
