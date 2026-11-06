import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBot,defaultBotReply,installDefaultBot} from '../default-bot.js';
import {selectAgent} from '../domain.js';
import {memoryDatabase,recordStore,routeHarness} from './memory-db.js';
const company={id:'company-a',name:'Empresa exemplo',settings:{hours:'Segunda a sexta, 08h às 18h',description:'Desenvolvemos sistemas personalizados.'}};
const reply=(text,contact={},type='text')=>defaultBotReply(company,[{direction:'in',text,type}],contact);
test('preset needs no provider credentials, starts off and respects contact pause',()=>{
 const bot=defaultBot(company);assert.equal(bot.enabled,false);assert.equal(bot.provider,'builtin');assert.equal(bot.encryptedKey,undefined);
 assert.notEqual(bot.id,defaultBot({...company,id:'company-b'}).id);
 assert.equal(selectAgent([{...bot,enabled:true}],{paused:true}),null);
 assert.equal(selectAgent([{...bot,enabled:true}],{stage:'novo'}).id,bot.id);
});
test('ready bot greets, qualifies budget and hands the answer to staff without inventing prices',()=>{
 const hello=reply('Oi');assert.match(hello.reply,/Empresa exemplo/);assert.match(hello.reply,/3 · Falar/);
 const budget=reply('2',{defaultBotStep:hello.nextStep});assert.equal(budget.nextStep,'budget');assert.match(budget.reply,/qual produto/);assert.equal(budget.handoff,false);
 const details=reply('Preciso de um CRM para 5 atendentes',{defaultBotStep:budget.nextStep});assert.equal(details.handoff,true);assert.match(details.note,/CRM/);assert.match(details.reply,/fila da equipe/);
 assert.doesNotMatch(budget.reply+details.reply,/R\$/);
});
test('human requests, unsupported audio, actual company hours and opt out follow the ready script',()=>{
 assert.equal(reply('Quero um atendente').handoff,true);assert.equal(reply('Mensagem de voz',{},'audio').handoff,true);
 assert.match(reply('Qual o horário?').reply,/08h às 18h/);assert.match(reply('1').reply,/sistemas personalizados/);
 assert.equal(reply('Pare de me enviar mensagens').stop,true);assert.equal(reply('Pare').reply,'');
});
test('one activation enables the preset and hybrid attendance without credentials or touching another company',async()=>{
 const db=memoryDatabase(),deps=recordStore(db),{app,request}=routeHarness();
 db.tables.startsys_companies.push({...company,owner_id:'owner-a',settings:{autoReply:false,workMode:'team',teamEnabled:true}},{id:'company-b',owner_id:'owner-b',settings:{autoReply:false,workMode:'team'}});
 app.use((req,res,next)=>{req.owner='owner-a';req.company=structuredClone(db.tables.startsys_companies[0]);next();});
 installDefaultBot(app,deps);
 const enabled=await request('/bot/default','POST',{enabled:true});assert.equal(enabled.statusCode,200);assert.equal(enabled.body.agent.enabled,true);assert.equal(enabled.body.agent.hasKey,false);assert.equal(db.tables.startsys_companies[0].settings.workMode,'hybrid');assert.equal(db.tables.startsys_companies[0].settings.autoReply,true);assert.equal(db.tables.startsys_companies[0].settings.teamEnabled,true);assert.equal(db.tables.startsys_companies[1].settings.autoReply,false);
 await request('/bot/default','POST',{enabled:true});assert.equal((await deps.rows(company.id,'agent')).length,1);
 const paused=await request('/bot/default','POST',{enabled:false});assert.equal(paused.body.agent.enabled,false);
});
