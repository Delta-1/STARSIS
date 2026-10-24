export const API=import.meta.env.VITE_GATEWAY_URL||'https://startsys-production.up.railway.app';
let accessToken=sessionStorage.getItem('startsys-token')||localStorage.getItem('startsys-token')||'';
export function setToken(token:string,remember=false){accessToken=token;sessionStorage.removeItem('startsys-token');localStorage.removeItem('startsys-token');if(token)(remember?localStorage:sessionStorage).setItem('startsys-token',token);}
export const hasToken=()=>!!accessToken;
export async function json(path:string,method='GET',body?:any):Promise<any>{const r=await fetch(`${API}/${path}`,{method,headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data:any=await r.json();if(!r.ok){if(r.status===401&&!path.startsWith('auth/'))window.dispatchEvent(new Event('startsys-session-expired'));throw Error(data.error||'Não foi possível concluir.');}return data;}
const mediaCache=new Map<string,string>();
export async function mediaUrl(id:string){if(mediaCache.has(id))return mediaCache.get(id)!;const r=await fetch(`${API}/media/${id}`,{headers:{Authorization:`Bearer ${accessToken}`}});if(!r.ok)throw Error('Não foi possível abrir o anexo.');const url=URL.createObjectURL(await r.blob());mediaCache.set(id,url);return url;}
export async function mediaBlob(id:string){const r=await fetch(`${API}/media/${id}`,{headers:{Authorization:`Bearer ${accessToken}`}});if(!r.ok)throw Error('Não foi possível baixar o anexo.');return r.blob();}
export function clearMedia(){for(const url of mediaCache.values())URL.revokeObjectURL(url);mediaCache.clear();}
