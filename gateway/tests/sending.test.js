import test from 'node:test';
import assert from 'node:assert/strict';
import {createSerial} from '../serial.js';
import {installSendRequests} from '../send-requests.js';
import {idFor} from '../domain.js';
import {memoryDatabase,recordStore,routeHarness} from './memory-db.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('manual send overtakes queued history while preserving exclusion, ordering and recovery',async()=>{
 const serial=createSerial(),gate=deferred(),order=[];let running=0;
 const first=serial('phone',async()=>{running++;await gate.promise;order.push('running history');running--;},-1);
 const history=Array.from({length:100},(_,i)=>serial('phone',async()=>{assert.equal(running,0);order.push('history '+i);},-1));
 const manual=serial('phone',async()=>{assert.equal(running,0);order.push('manual send');});
 const live=serial('phone',async()=>order.push('live incoming'),5);
 gate.resolve();await Promise.all([first,...history,manual,live]);
 assert.deepEqual(order.slice(0,3),['running history','manual send','live incoming']);
 assert.deepEqual(order.slice(3),Array.from({length:100},(_,i)=>'history '+i));
 await assert.rejects(serial('phone',()=>{throw Error('failed');}));assert.equal(await serial('phone',()=>42),42);
});

async function setup(send){
 const db=memoryDatabase(),deps=recordStore(db),{app,request}=routeHarness();
 let cid='company-a',allow=true;
 app.use((req,res,next)=>{req.company={id:cid,settings:{}};req.account={id:'owner-a',full_name:'Operador'};next();});
 const owned=async(req,id)=>{await deps.get(req.company.id,id,'contact');if(!allow)throw deps.fail(403,'Atendimento transferido');};
 installSendRequests(app,{...deps,serial:createSerial(),idFor,send,team:{owned,canSend:async req=>{if(!allow)throw deps.fail(403,'Atendimento transferido');return true;}},flows:{cancelContact:async()=>{}},personalMode:()=>false,timeoutMs:5});
 await deps.put(cid,'contact',{numberId:'phone'},'contact-a');
 return {...deps,request,setCompany:value=>{cid=value;},deny:()=>{allow=false;}};
}
const body={contactId:'contact-a',text:'Mensagem de teste local',requestId:'local-test-request-123456'};
test('slow submission responds pending, later settles and never sends duplicate request IDs',async()=>{
 const gate=deferred();let calls=0,h;
 h=await setup(async(cid,c,input)=>{calls++;await gate.promise;return h.put(cid,'message',{contactId:c.id,clientRequestId:input.requestId,text:input.text},'sent-message');});
 const response=await h.request('/send','POST',body);assert.equal(response.statusCode,202);assert.equal(response.body.status,'sending');assert.equal(calls,1);
 const duplicate=await h.request('/send','POST',body);assert.equal(duplicate.statusCode,202);assert.equal(calls,1);
 gate.resolve();
 const confirmed=await h.request('/send','POST',body);assert.equal(confirmed.body.id,'sent-message');assert.equal(calls,1);
 const status=await h.request('/send/'+body.requestId);assert.equal(status.body.status,'sent');assert.equal(status.body.message.text,body.text);
 h.setCompany('company-b');assert.equal((await h.request('/send/'+body.requestId)).statusCode,404);
 h.setCompany('company-a');h.deny();assert.equal((await h.request('/send/'+body.requestId)).statusCode,403);
});
test('ambiguous native failure stays uncertain and is never automatically retried',async()=>{
 let calls=0;const h=await setup(async()=>{calls++;throw Object.assign(Error('native timeout'),{submissionStarted:true});});
 const first=await h.request('/send','POST',body);assert.equal(first.statusCode,202);assert.equal(first.body.status,'uncertain');
 await h.request('/send','POST',body);assert.equal(calls,1);
 assert.equal((await h.request('/send/'+body.requestId)).body.status,'uncertain');
});
test('missing stored message and authorization failures cannot initiate another send',async()=>{
 let calls=0;const h=await setup(async()=>{calls++;});
 await h.put('company-a','request',{status:'sent',contactId:'contact-a',messageId:'missing'},idFor('company-a','request',body.requestId));
 assert.equal((await h.request('/send','POST',body)).statusCode,404);assert.equal(calls,0);
 h.deny();const response=await h.request('/send','POST',{...body,requestId:'different-local-request-1234'});assert.equal(response.statusCode,403);assert.equal(calls,0);
});
