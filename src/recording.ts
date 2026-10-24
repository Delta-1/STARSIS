export const MAX_RECORDING_MS=10*60*1000;
export function preferredRecordingType(supported:(type:string)=>boolean){
 return ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'].find(supported)||'';
}
export function recordingExtension(mime:string){return mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm';}
export function createVoiceRecorder(stream:MediaStream,onReady:(blob:Blob)=>void,onFailure:(error:Error)=>void,onFinished:()=>void){
 const mime=preferredRecordingType(type=>MediaRecorder.isTypeSupported(type));
 const recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:64000});
 const chunks:BlobPart[]=[];let cancelled=false,finished=false;
 const release=()=>{stream.getTracks().forEach(track=>track.stop());if(!finished){finished=true;onFinished();}};
 recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
 recorder.onerror=()=>{cancelled=true;release();onFailure(Error('A gravação foi interrompida. Grave novamente.'));};
 recorder.onstop=()=>{
  try{if(!cancelled){const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});if(blob.size<100)throw Error('A gravação ficou vazia. Grave novamente.');onReady(blob);}}
  catch(error){onFailure(error instanceof Error?error:Error('Não foi possível finalizar a gravação.'));}
  finally{release();}
 };
 recorder.start(1000);
 return {recorder,cancel(){cancelled=true;if(recorder.state!=='inactive')recorder.stop();release();},stop(){if(recorder.state!=='inactive')recorder.stop();}};
}
