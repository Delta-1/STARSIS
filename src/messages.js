// Preserve loaded history while polling the latest page, and update edits in place.
export function mergeMessages(previous,incoming,older=false){
 const byId=new Map(),local=m=>['pending','failed','uncertain'].includes(m.delivery);
 const add=message=>{const key=message.clientRequestId||message.id,existing=byId.get(key);if(existing&&!local(existing)&&local(message))return;byId.set(key,message);};
 for(const message of older?[...incoming,...previous]:[...previous,...incoming])add(message);
 for(const message of incoming)add(message);
 return [...byId.values()];
}
