export const API=import.meta.env.VITE_GATEWAY_URL||(import.meta.env.DEV?'/gateway':'https://startsys-production.up.railway.app');
let sessionGeneration=0;
let accessToken=sessionStorage.getItem('startsys-token')||localStorage.getItem('startsys-token')||'';
export function setToken(token:string,remember=false){sessionGeneration++;clearMedia();accessToken=token;sessionStorage.removeItem('startsys-token');localStorage.removeItem('startsys-token');if(token)(remember?localStorage:sessionStorage).setItem('startsys-token',token);}
export const hasToken=()=>!!accessToken;
export async function json(path:string,method='GET',body?:any,token=accessToken):Promise<any>{const r=await fetch(`${API}/${path}`,{method,signal:AbortSignal.timeout(95000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data:any=await r.json().catch(()=>({error:'Serviço temporariamente indisponível. Tente novamente.'}));if(!r.ok){if(r.status===401&&!path.startsWith('auth/'))window.dispatchEvent(new Event('startsys-session-expired'));throw Error(data.error||'Não foi possível concluir.');}return data;}
export function subscribeChanges(onChange:()=>void) {
 let stopped=false,cursor='',controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>;
 const generation=sessionGeneration;
 async function poll(){
  if(stopped||generation!==sessionGeneration)return;
  if(document.hidden){timer=setTimeout(poll,3000);return;}
  controller=new AbortController();
  try{
   const response=await fetch(`${API}/changes?since=${encodeURIComponent(cursor)}`,{headers:{Authorization:`Bearer ${accessToken}`},signal:controller.signal});
   if(response.status===401){window.dispatchEvent(new Event('startsys-session-expired'));return;}
   if(!response.ok)throw Error('offline');
   const value=await response.json();cursor=value.cursor;
   if(!stopped&&value.changed)onChange();
   if(!stopped)timer=setTimeout(poll,200);
  }catch{if(!stopped)timer=setTimeout(()=>{onChange();poll();},5000);}
 }
 const wake=()=>{if(!document.hidden)onChange();};
 document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);poll();
 return()=>{stopped=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);};
}
const mediaCache=new Map<string,string>();
const mediaPending=new Map<string,Promise<string>>();
export async function mediaUrl(id:string){
 if(mediaCache.has(id))return mediaCache.get(id)!;
 if(mediaPending.has(id))return mediaPending.get(id)!;
 const generation=sessionGeneration;
 const pending=(async()=>{
  const r=await fetch(`${API}/media/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(95000),headers:{Authorization:`Bearer ${accessToken}`}});
  if(!r.ok)throw Error('Não foi possível abrir o anexo.');
  const blob=await r.blob();
  if(generation!==sessionGeneration)throw Error('Sessão alterada.');
  const url=URL.createObjectURL(blob);mediaCache.set(id,url);return url;
 })();
 mediaPending.set(id,pending);
 try{return await pending;}finally{if(mediaPending.get(id)===pending)mediaPending.delete(id);}
}
export async function mediaBlob(id:string){const r=await fetch(`${API}/media/${id}`,{headers:{Authorization:`Bearer ${accessToken}`}});if(!r.ok)throw Error('Não foi possível baixar o anexo.');return r.blob();}
export function clearMedia(){for(const url of mediaCache.values())URL.revokeObjectURL(url);mediaCache.clear();mediaPending.clear();}

export function clientId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));}
