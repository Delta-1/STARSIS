import test from 'node:test';import assert from 'node:assert/strict';import {installFlows} from '../flows.js';import {idFor} from '../domain.js';import {validateFlow,matches,canContinue,simulateFlow} from '../flow-domain.js';import {memoryDatabase,recordStore,routeHarness} from './memory-db.js';
const node=(id,type,data={})=>({id,type,x:0,y:0,data}),edge=(from,to,handle='out')=>({id:from+handle+to,from,to,handle});
const linear=nodes=>({nodes:[node('start','start'),...nodes,node('end','end')],edges:[...['start',...nodes.map(n=>n.id)].map((id,i)=>edge(id,[...nodes.map(n=>n.id),'end'][i]))]});
async function setup(flow){const db=memoryDatabase(),deps=recordStore(db),{app,request}=routeHarness(),sent=[];db.tables.startsys_companies.push({id:'co',owner_id:'owner',settings:{autoReply:false,usageMode:'company',teamEnabled:true}});await deps.put('co','contact',{name:'Contato',numberId:'number',paused:true,lastManualReplyAt:'2020-01-01T00:00:00.000Z'},'contact');await deps.put('co','flow-rule',{name:'Atendimento',flow,enabled:true,trigger:'manual',cooldownMinutes:1},'rule');app.use(async(req,res,next)=>{req.company=await deps.companyById('co');next();});const engine=installFlows(app,{...deps,idFor,startTimer:false,send:async(cid,contact,input,agentId,requestId,guard)=>{if(!await guard())return null;sent.push({...input,contactId:contact.id});return {id:'sent-'+sent.length};},agentReply:async()=>({reply:'Resposta da IA'})});return {db,...deps,engine,sent,request};}
async function latest(h){return h.get('co',idFor('co','active-flow','contact'),'flow-run');}
async function step(h){await h.engine.runOne(await latest(h));return latest(h);}
async function start(h){await h.request('/flows/rule/start','POST',{contactId:'contact'});return latest(h);}
test('flow validator supports thirty saved audios, rejects loops, unreachable blocks and missing branches',()=>{
 const flow=linear(Array.from({length:30},(_,i)=>node('audio'+i,'audio',{clipId:'clip'+i})));assert.equal(validateFlow(flow),null);assert.equal(simulateFlow(flow,'').filter(s=>s.startsWith('Áudio:')).length,30);
 const loop=structuredClone(flow);loop.edges[1].to='audio0';assert.match(validateFlow(loop),/anterior/);const missing=structuredClone(flow);missing.edges.pop();assert.match(validateFlow(missing),/saídas/);const orphan=structuredClone(flow);orphan.nodes.push(node('orphan','end'));assert.match(validateFlow(orphan),/soltos/);
 assert.equal(matches('contains','ORÇAMENTO\npreço','Preciso do orcamento'),true);assert.equal(matches('exact','sim','sim, obrigado'),false);
});
test('manual flows send stored audio and text without requiring an agent, preserving completed execution history',async()=>{
 const h=await setup(linear([node('hello','text',{text:'Olá, {{nome}}'}),node('audio','audio',{clipId:'clip'})]));await h.put('co','audio-clip',{name:'Apresentação',mediaId:'media'},'clip');await h.put('co','media',{base64:Buffer.from('prepared-offline-audio').toString('base64'),mime:'audio/ogg'},'media');
 await start(h);await step(h);await step(h);await step(h);assert.equal(h.sent.length,2);assert.equal(h.sent[0].text,'Olá, Contato');assert.equal(h.sent[1].type,'audio');assert.equal(h.sent[1].base64,Buffer.from('prepared-offline-audio').toString('base64'));assert.equal((await step(h)).status,'done');assert.equal((await h.get('co','contact','contact')).activeFlowId,null);
 await start(h);await step(h);await step(h);await step(h);await step(h);assert.equal((await h.rows('co','flow-history')).length,2);
});
test('delays and replies persist in saved run state; branches use the latest answer',async()=>{
 const flow={nodes:[node('start','start'),node('wait','reply',{minutes:1}),node('condition','condition',{mode:'contains',keywords:'sim'}),node('yes','text',{text:'Certo, vou seguir.'}),node('no','text',{text:'Vou chamar a equipe.'}),node('end','end')],edges:[edge('start','wait'),edge('wait','condition','reply'),edge('wait','no','timeout'),edge('condition','yes','yes'),edge('condition','no','no'),edge('yes','end'),edge('no','end')]};assert.equal(validateFlow(flow),null);
 const h=await setup(flow);await start(h);await step(h);assert.equal((await step(h)).status,'waiting');await step(h);assert.equal(h.sent.length,0);
 await h.engine.incoming('co',await h.get('co','contact','contact'),{text:'sim',at:new Date().toISOString(),receivedAt:new Date().toISOString()});assert.equal((await latest(h)).nodeId,'condition');await step(h);await step(h);assert.equal(h.sent[0].text,'Certo, vou seguir.');await step(h);
 const delay=linear([node('delay','delay',{minutes:.1}),node('later','text',{text:'Depois'})]);await h.put('co','flow-rule',{name:'Com espera',flow:delay,enabled:true},'rule');await start(h);await step(h);const delayed=await step(h);await step(h);assert.equal(h.sent.length,1);await h.put('co','flow-run',{...delayed,dueAt:new Date(Date.now()-1000).toISOString()},delayed.id);await step(h);assert.equal(h.sent[1].text,'Depois');
});
test('human takeover, opt-out, disabling a rule and ambiguous sends stop the next step',async()=>{
 for(const change of [{lastManualReplyAt:'2999-01-01T00:00:00Z'},{optOut:true},{activeFlowId:null}]){const h=await setup(linear([node('message','text',{text:'Não enviar'})]));await start(h);await step(h);const c=await h.get('co','contact','contact');await h.put('co','contact',{...c,...change},c.id);assert.equal((await step(h)).status,'cancelled');assert.equal(h.sent.length,0);}
 const h=await setup(linear([node('message','text',{text:'Não reenviar'})]));await start(h);await step(h);let run=await latest(h);await h.put('co','flow-run',{...run,status:'sending'},run.id);await step(h);assert.equal(h.sent.length,0);
 const contact={id:'c',activeFlowId:'r',paused:false,lastManualReplyAt:null};assert.equal(canContinue({settings:{autoReply:false}},contact,{id:'r',manual:false}),false);assert.equal(canContinue({settings:{autoReply:false}},contact,{id:'r',manual:true}),true);
});
test('active flows block a second manual start and only the same tenant can reference saved audio',async()=>{
 const h=await setup(linear([node('message','text',{text:'Teste'})]));assert.equal((await h.request('/flows/rule/start','POST',{contactId:'contact'})).statusCode,200);assert.equal((await h.request('/flows/rule/start','POST',{contactId:'contact'})).statusCode,409);
 await h.put('foreign','audio-clip',{name:'Privado',mediaId:'foreign-media'},'foreign-clip');const bad=await h.request('/flows','POST',{name:'Fora da empresa',flow:linear([node('audio','audio',{clipId:'foreign-clip'})]),trigger:'manual',matchMode:'any'});assert.equal(bad.statusCode,404);
});
test('incoming triggers honor global pause, human ownership and keyword matching',async()=>{
 const h=await setup(linear([node('message','text',{text:'Fluxo acionado'})]));const co=h.db.tables.startsys_companies[0];co.settings.autoReply=true;
 const rule=await h.get('co','rule','flow-rule');await h.put('co','flow-rule',{...rule,trigger:'incoming',matchMode:'contains',keywords:'suporte',priority:1},rule.id);let c=await h.get('co','contact','contact');
 assert.equal(await h.engine.incoming('co',c,{text:'Preciso de suporte'}),false);
 c=await h.put('co','contact',{...c,paused:false,assignedTo:'employee'},c.id);assert.equal(await h.engine.incoming('co',c,{text:'Preciso de suporte'}),false);
 c=await h.put('co','contact',{...c,assignedTo:null},c.id);assert.equal(await h.engine.incoming('co',c,{text:'Outro assunto'}),false);assert.equal(await h.engine.incoming('co',c,{text:'Preciso de SUPORTE'}),true);
 await step(h);await step(h);assert.equal(h.sent[0].text,'Fluxo acionado');await step(h);assert.equal(await h.engine.incoming('co',await h.get('co','contact','contact'),{text:'Preciso de suporte'}),false);
});
test('AI is consulted only in its chosen block and a reply timeout follows its own branch',async()=>{
 const h=await setup(linear([node('agent','ai',{agentId:'agent',instruction:'Responda a dúvida técnica.'})]));await h.put('co','agent',{name:'IA de suporte',enabled:false,encryptedKey:'local-mock-only'},'agent');await start(h);await step(h);await step(h);assert.equal(h.sent[0].text,'Resposta da IA');await step(h);
 const flow={nodes:[node('start','start'),node('reply','reply',{minutes:.1}),node('answered','text',{text:'Recebido'}),node('timedout','text',{text:'Sem resposta, vou encerrar.'}),node('end','end')],edges:[edge('start','reply'),edge('reply','answered','reply'),edge('reply','timedout','timeout'),edge('answered','end'),edge('timedout','end')]};await h.put('co','flow-rule',{name:'Prazo',enabled:true,flow},'rule');await start(h);await step(h);const waiting=await step(h);await h.put('co','flow-run',{...waiting,dueAt:new Date(Date.now()-1000).toISOString()},waiting.id);await step(h);assert.equal(h.sent[1].text,'Sem resposta, vou encerrar.');
});
