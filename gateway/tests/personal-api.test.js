import test from 'node:test';import assert from 'node:assert/strict';import {installPersonal} from '../personal.js';import {idFor} from '../domain.js';
function harness(){
 const handlers={},records=new Map(),queues=new Map(),sent=[];
 const fail=(status,message)=>Object.assign(Error(message),{status}),get=async(cid,id,kind)=>{const v=records.get(cid+':'+kind+':'+id);if(!v)throw fail(404,'Registro não encontrado');return {...v,id};},put=async(cid,kind,value,id)=>{records.set(cid+':'+kind+':'+id,{...value,id});return {...value,id};};
 const serial=(key,fn)=>{const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,next);return next;};
 const app={get:(p,h)=>handlers['GET '+p]=h,post:(p,h)=>handlers['POST '+p]=h,patch:(p,h)=>handlers['PATCH '+p]=h};
 installPersonal(app,{db:{},get,put,rows:async()=>[],send:async(...args)=>sent.push(args),connected:()=>{},crypt:{},fail,idFor,serial,maybeReply:()=>{},companyById:async()=>{},selectAgent:()=>{},generateMessageIDV2:()=> 'local-only'});
 async function request(path,company='a',body={}){let value;await handlers['POST '+path]({company:{id:company,settings:{}},params:{id:'approval'},body},{json:v=>value=v});return value;}
 return {put,get,request,sent};
}
test('approvals cannot expose or send another tenant’s reply',async()=>{
 const h=harness();await h.put('a','approval',{status:'pending',contactId:'contact',sourceAt:'incoming',reply:'Aprovado'},'approval');
 await assert.rejects(h.request('/approvals/:id/approve','b'),e=>e.status===404);assert.equal(h.sent.length,0);
});
test('owner replies invalidate approvals and concurrent approvals send exactly once',async()=>{
 const h=harness();await h.put('a','contact',{lastInboundAt:'incoming',lastDirection:'out'},'contact');await h.put('a','approval',{status:'pending',contactId:'contact',sourceAt:'incoming',reply:'Aprovado'},'approval');
 await assert.rejects(h.request('/approvals/:id/approve'),e=>e.status===409);assert.equal(h.sent.length,0);
 await h.put('a','contact',{lastInboundAt:'incoming',lastDirection:'in'},'contact');await h.put('a','approval',{status:'pending',contactId:'contact',sourceAt:'incoming',reply:'Aprovado'},'approval');
 const result=await Promise.allSettled([h.request('/approvals/:id/approve'),h.request('/approvals/:id/approve')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.sent.length,1);assert.equal((await h.get('a','approval','approval')).status,'sent');
});
