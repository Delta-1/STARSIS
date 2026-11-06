import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroupSync,groupDetails,assertGroupSend} from '../groups.js';
const fail=(status,message)=>Object.assign(Error(message),{status});

test('group sync keeps empty groups, names, size, ownership and independent company records',async()=>{
 const writes=[],seen=[],session={sock:{user:{id:'5511999999999:4@s.whatsapp.net'},groupFetchAllParticipating:async()=>({group:{id:'1200001@g.us',subject:'Suporte do cliente',participants:[{id:'5511888888888@s.whatsapp.net'}]}})}};
 const sync=createGroupSync({connected:()=>session,ensureContact:async(cid,n,key)=>{seen.push({cid,id:n.id,jid:key.remoteJid});return {id:cid+':group',assignedTo:'employee-a',paused:true,notes:'Contexto do atendimento'};},put:async(cid,kind,value,id)=>writes.push({cid,kind,value,id}),rememberIdentity:async()=>{}});
 assert.deepEqual(await sync('company-a',{id:'number-a'}),{count:1});
 assert.equal(writes[0].value.name,'Suporte do cliente');assert.equal(writes[0].value.groupCanSend,true);assert.equal(writes[0].value.lastAt,undefined);assert.equal(writes[0].value.assignedTo,'employee-a');assert.equal(writes[0].value.notes,'Contexto do atendimento');
 await sync('company-b',{id:'number-b'});assert.equal(writes[1].id,'company-b:group');assert.equal(seen[1].jid,'1200001@g.us');
});
test('announcement permission matches connected admin through phone, LID and device identifiers',()=>{
 const group={announce:true,participants:[{id:'778899@lid',phoneNumber:'5511999999999@s.whatsapp.net',admin:'admin'}]};
 assert.equal(groupDetails(group,{id:'5511999999999:12@s.whatsapp.net'}).groupCanSend,true);
 assert.equal(groupDetails(group,{lid:'778899:3@lid'}).groupCanSend,true);
 assert.equal(groupDetails(group,{id:'5511888888888@s.whatsapp.net'}).groupCanSend,false);
 assert.equal(groupDetails({...group,announce:false},{id:'5511888888888@s.whatsapp.net'}).groupCanSend,true);
});
test('group sends check current WhatsApp permissions rather than trusting cached client flags',async()=>{
 const sock={user:{id:'5511999999999@s.whatsapp.net'},groupMetadata:async jid=>{assert.equal(jid,'1200001@g.us');return {announce:true,participants:[]};}};
 await assert.rejects(()=>assertGroupSend(sock,{isGroup:true,jid:'1200001@g.us',groupCanSend:true},fail),e=>e.status===403);
 sock.groupMetadata=async()=>({announce:false,participants:[]});assert.equal((await assertGroupSend(sock,{isGroup:true,jid:'1200001@g.us'},fail)).groupCanSend,true);
});
