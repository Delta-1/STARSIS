import {normalizeJid} from './chat-identity.js';

export function groupDetails(group,user={}) {
 const own=new Set([user.id,user.lid].map(normalizeJid).filter(Boolean));
 const participants=group.participants||[];
 const admin=participants.some(p=>p.admin&&[p.id,p.lid,p.phoneNumber].map(normalizeJid).some(id=>own.has(id)));
 return {isGroup:true,groupAnnounce:!!group.announce,groupSize:participants.length,groupCanSend:!group.announce||admin};
}

export async function assertGroupSend(sock,contact,fail) {
 if(!contact.isGroup)return;
 const details=groupDetails(await sock.groupMetadata(contact.jid),sock.user);
 if(!details.groupCanSend)throw fail(403,'Apenas administradores podem enviar mensagens neste grupo.');
 return details;
}

export function createGroupSync({connected,ensureContact,put,rememberIdentity}) {
 return async function syncGroups(cid,number) {
  const session=connected(number.id);
  if(session.groupSync)return session.groupSync;
  session.groupSync=(async()=>{
   const groups=await session.sock.groupFetchAllParticipating();let count=0;
   for(const group of Object.values(groups)) {
    const contact=await ensureContact(cid,number,{remoteJid:group.id});
    await put(cid,'contact',{...contact,name:group.subject||contact.name,...groupDetails(group,session.sock.user)},contact.id);
    for(const participant of group.participants||[])await rememberIdentity(cid,number.id,participant.lid||participant.id,participant.phoneNumber||participant.id);
    count++;
   }
   return {count};
  })();
  try{return await session.groupSync;}finally{session.groupSync=null;}
 };
}
