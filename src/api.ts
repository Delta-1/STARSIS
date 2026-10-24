export const API=import.meta.env.VITE_GATEWAY_URL||'https://startsys-production.up.railway.app';
let sessionGeneration=0;
let accessToken=sessionStorage.getItem('startsys-token')||localStorage.getItem('startsys-token')||'';
export function setToken(token:string,remember=false){sessionGeneration++;clearMedia();accessToken=token;sessionStorage.removeItem('startsys-token');localStorage.removeItem('startsys-token');if(token)(remember?localStorage:sessionStorage).setItem('startsys-token',token);}
export const hasToken=()=>!!accessToken;
export async function json(path:string,method='GET',body?:any):Promise<any>{const r=await fetch(`${API}/${path}`,{method,signal:AbortSignal.timeout(95000),headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data:any=await r.json().catch(()=>({error:'Serviço temporariamente indisponível. Tente novamente.'}));if(!r.ok){if(r.status===401&&!path.startsWith('auth/'))window.dispatchEvent(new Event('startsys-session-expired'));throw Error(data.error||'Não foi possível concluir.');}return data;}
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
