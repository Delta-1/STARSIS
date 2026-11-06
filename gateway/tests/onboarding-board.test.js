import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createTeam} from '../team.js';
import {installAuth,hashPassword,tokenHash} from '../auth.js';
import {createTrials} from '../trial.js';
import {createChanges} from '../changes.js';
import {installWhiteboard} from '../whiteboard.js';
import {memoryDatabase,recordStore,routeHarness} from './memory-db.js';

async function setup(){
 const db=memoryDatabase(),deps=recordStore(db),{app,request}=routeHarness(),connections=new Map();
 const company=async owner=>structuredClone(db.tables.startsys_companies.find(c=>c.owner_id===owner));
 const trial=createTrials({...deps,company,start:async(cid,n)=>connections.set(n.id,{status:'qr_pending',qr:'data:image/png;base64,TEST'}),stateFor:id=>connections.get(id)||{status:'disconnected'},stop:async id=>connections.delete(id)});
 const team=createTeam({...deps,secret:'only-local-testing-secret-'.repeat(3)});
 installAuth(app,db,{team,trial});app.use(team.gate);app.use(async(req,res,next)=>{req.company=await company(req.owner);next();});team.install(app);installWhiteboard(app,{...deps,del:async(cid,id,kind)=>{await deps.get(cid,id,kind);await db.from('startsys_records').delete().eq('company_id',cid).eq('id',id);}});
 return {db,...deps,request,trial,team,connections};
}
const ownerValues={name:'Admin de teste',email:'onboarding@example.invalid',companyName:'Empresa local',password:'individual-local-password'};
test('QR is issued before registration; saving account retains number, company and history and revokes guest session',async()=>{
 const h=await setup(),guest=await h.request('/auth/trial','POST');assert.equal(guest.statusCode,200);assert.equal(guest.body.user.role,'trial');
 const token=guest.body.token,co=h.db.tables.startsys_companies[0],n=h.db.tables.startsys_records.find(r=>r.kind==='number');assert.ok(co.settings.trial);assert.equal(co.settings.autoReply,false);
 const qr=await h.request('/auth/trial/status','GET',{},token);assert.equal(qr.body.status,'qr_pending');assert.ok(qr.body.qr);
 assert.equal((await h.request('/auth/trial/status','GET',{},'forged')).statusCode,401);
 await h.put(co.id,'message',{text:'Histórico privado'},'historic');
 const saved=await h.request('/auth/register','POST',{...ownerValues,trialToken:token});assert.equal(saved.statusCode,200);assert.equal(saved.body.user.role,'owner');assert.equal(h.db.tables.startsys_companies[0].id,co.id);assert.equal(h.db.tables.startsys_companies[0].settings.trial,false);assert.equal((await h.get(co.id,n.id,'number')).id,n.id);assert.equal((await h.get(co.id,'historic','message')).text,'Histórico privado');
 assert.equal((await h.request('/auth/me','GET',{},token)).statusCode,401);assert.equal((await h.request('/auth/me','GET',{},saved.body.token)).statusCode,200);
});
test('trial creation is bounded and expired credentials cannot read account data or mint invitations',async()=>{
 const h=await setup(),a=await h.request('/auth/trial','POST');
 assert.equal((await h.request('/team/invite','POST',{},a.body.token)).statusCode,403);
 const co=h.db.tables.startsys_companies[0];co.settings.trialExpiresAt='2000-01-01T00:00:00Z';assert.equal((await h.request('/auth/me','GET',{},a.body.token)).statusCode,401);
 await h.request('/auth/trial','POST');await h.request('/auth/trial','POST');assert.equal((await h.request('/auth/trial','POST')).statusCode,429);
});
test('invitation enrolls only in its company, can be revoked, and code enrollment requires explicit enablement',async()=>{
 const h=await setup(),guest=await h.request('/auth/trial','POST'),owner=await h.request('/auth/register','POST',{...ownerValues,trialToken:guest.body.token}),token=owner.body.token,co=h.db.tables.startsys_companies[0];
 const code=(await h.request('/team','GET',{},token)).body.code;
 assert.equal((await h.request('/auth/employee/register','POST',{companyCode:code,name:'Atendente',password:'unique-local-staff'})).statusCode,403);
 const link=(await h.request('/team/invite','POST',{},token)).body.invite;assert.ok(link);assert.equal(JSON.stringify(h.db.tables.startsys_records).includes(link),false);
 const joined=await h.request('/auth/employee/register','POST',{invite:link,name:'Atendente Ana',password:'unique-local-staff'});assert.equal(joined.statusCode,200);assert.equal(joined.body.user.companyId,co.id);assert.equal(joined.body.user.role,'employee');
 await h.request('/team/invite','POST',{revoke:true},token);assert.equal((await h.request('/auth/employee/register','POST',{invite:link,name:'Atendente B',password:'different-local-staff'})).statusCode,410);assert.equal((await h.request('/auth/me','GET',{},joined.body.token)).statusCode,200);
 co.settings.allowCodeSignup=true;const byCode=await h.request('/auth/employee/register','POST',{companyCode:code,name:'Atendente Bruno',password:'another-local-staff'});assert.equal(byCode.statusCode,200);
 // A staff session can neither create invitations nor read the company owner settings.
 assert.equal((await h.request('/team/invite','POST',{},byCode.body.token)).statusCode,403);
});
test('shared notes persist positions, reject stale edits and isolate different companies',async()=>{
 const h=await setup(),guest=await h.request('/auth/trial','POST'),owner=await h.request('/auth/register','POST',{...ownerValues,trialToken:guest.body.token}),token=owner.body.token;
 const invite=(await h.request('/team/invite','POST',{},token)).body.invite,staff=await h.request('/auth/employee/register','POST',{invite,name:'Atendente',password:'board-local-staff'}),staffToken=staff.body.token;
 const added=await h.request('/whiteboard','POST',{title:'Retomar proposta',text:'Confirmar horário',x:310,y:210,color:'pink',remindAt:'2030-01-01T12:00:00Z'},staffToken);assert.equal(added.statusCode,200);const note=added.body;
 const results=await Promise.all([h.request(`/whiteboard/${note.id}`,'PATCH',{revision:1,x:600,y:80},token),h.request(`/whiteboard/${note.id}`,'PATCH',{revision:1,text:'Alteração concorrente'},staffToken)]);assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
 const saved=(await h.request('/whiteboard','GET',{},staffToken)).body[0];assert.equal(saved.x,600);assert.equal(saved.y,80);assert.equal(saved.text,'Confirmar horário');assert.equal(saved.revision,2);
 const other=await h.request('/auth/trial','POST');assert.equal((await h.request(`/whiteboard/${note.id}`,'PATCH',{revision:2,text:'Intrusão'},other.body.token)).statusCode,404);
});
test('change cursors wake only the matching company and release listeners after the response closes',()=>{
 const changes=createChanges(),cid='company-a';let body;const res=new EventEmitter();res.json=v=>{body=v;return res;};res.status=()=>res;
 changes.wait(cid,changes.cursor(cid),{},res);changes.publish('company-b');assert.equal(body,undefined);changes.publish(cid);assert.equal(body.changed,true);assert.equal(res.listenerCount('close'),0);
 const closed=new EventEmitter();closed.json=()=>assert.fail('closed response');closed.status=()=>closed;changes.wait(cid,changes.cursor(cid),{},closed);closed.emit('close');changes.publish(cid);assert.equal(closed.listenerCount('close'),0);
});
