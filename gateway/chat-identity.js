export const normalizeJid=value=>String(value||'').replace(/:\d+(?=@)/,'');
export const isGroupJid=jid=>normalizeJid(jid).endsWith('@g.us');
export function phoneFromJid(jid){const match=normalizeJid(jid).match(/^(\d{8,16})@s\.whatsapp\.net$/);return match?match[1]:'';}
export function identityCandidates(key={}){
 return [...new Set([key.remoteJid,key.remoteJidAlt].map(normalizeJid).filter(Boolean))];
}
export async function resolveIdentity(key,sock,lookup=async()=>null){
 const aliases=identityCandidates(key),group=aliases.find(isGroupJid);
 if(group)return {jid:group,aliases:[group],phone:'',isGroup:true};
 let jid=aliases.find(phoneFromJid);
 if(!jid){const lid=aliases.find(v=>v.endsWith('@lid'));if(lid){
  let mapped;try{mapped=await sock?.signalRepository?.lidMapping?.getPNForLID(lid);}catch{}
  if(!phoneFromJid(mapped))mapped=await lookup(lid);
  if(phoneFromJid(mapped)){jid=normalizeJid(mapped);aliases.push(jid);}
 }}
 jid=jid||aliases[0]||'';
 return {jid,aliases:[...new Set(aliases)],phone:phoneFromJid(jid),isGroup:false};
}
export function contactLabel(identity,old={},pushName=''){
 if(identity.isGroup)return old.name||'Grupo do WhatsApp';
 // A LID is an opaque identifier. It must never be displayed as a phone number.
 return identity.phone||old.phone||old.nameCustom||old.pushName||pushName||'Contato do WhatsApp';
}
export function canAutoReplyToGroup(contact,incoming,ownIds=[]){
 if(!contact.isGroup)return true;
 if(contact.paused)return false;
 const own=new Set(ownIds.map(normalizeJid).filter(Boolean));
 return (incoming.mentions||[]).some(jid=>own.has(normalizeJid(jid)))||own.has(normalizeJid(incoming.quotedParticipant));
}
