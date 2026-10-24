import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=await readFile(new URL('../src/recording.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createVoiceRecorder,preferredRecordingType}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('recording waits for the final data chunk before exposing the preview',()=>{
 let instance,stopped=0,ready=0,finished=0,blob;
 globalThis.MediaRecorder=class{static isTypeSupported(t){return t==='audio/webm;codecs=opus';}constructor(stream,opts){instance=this;this.mimeType=opts.mimeType;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';}};
 const stream={getTracks:()=>[{stop:()=>stopped++}]};
 const controller=createVoiceRecorder(stream,b=>{ready++;blob=b;},e=>{throw e;},()=>finished++);
 controller.stop();assert.equal(ready,0);instance.ondataavailable({data:new Blob(['a'.repeat(200)])});instance.onstop();assert.equal(ready,1);assert.equal(blob.size,200);assert.equal(blob.type,'audio/webm;codecs=opus');assert.equal(stopped,1);assert.equal(finished,1);
});
test('discarding a recording suppresses late chunks and releases microphone',()=>{
 let instance,ready=0,stopped=0;globalThis.MediaRecorder=class{static isTypeSupported(){return false;}constructor(){instance=this;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';}};
 const c=createVoiceRecorder({getTracks:()=>[{stop:()=>stopped++}]},()=>ready++,()=>{},()=>{});c.cancel();instance.ondataavailable({data:new Blob(['a'.repeat(200)])});instance.onstop();assert.equal(ready,0);assert.ok(stopped>=1);assert.equal(preferredRecordingType(t=>t==='audio/mp4'),'audio/mp4');
});
