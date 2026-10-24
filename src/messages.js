// Preserve loaded history while polling the latest page, and update edits in place.
export function mergeMessages(previous,incoming,older=false){
 const byId=new Map();
 for(const message of older?[...incoming,...previous]:[...previous,...incoming])byId.set(message.id,message);
 for(const message of incoming)byId.set(message.id,message);
 return [...byId.values()];
}
