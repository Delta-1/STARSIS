import {randomUUID} from 'node:crypto';
import {validateFlow,matches,nextNode,renderText,canContinue} from './flow-domain.js';
import {prepareVoiceAudio} from './voice-audio.js';
const active=run=>['ready','waiting','sending'].includes(run.status);
export function installFlows(app,deps){
 const {db,get,put,rows,fail,serial,idFor,companyById,send,audit,agentReply,ffmpeg}=deps;
 async function readRun(cid,contactId){try{return await get(cid,idFor(cid,'active-flow',contactId),'flow-run');}catch(e){if(e.status===404)return null;throw e;}}
 async function save(run,patch){return put(run.companyId,'flow-run',{...run,...patch,revision:randomUUID()},run.id);}
 async function finish(run,status,error=''){
  const completed=await save(run,{status,error,nodeId:null,dueAt:null});await put(run.companyId,'flow-history',{...completed,endedAt:new Date().toISOString()},idFor(run.id,run.executionId||run.startedAt,'history'));
  const c=await get(run.companyId,run.contactId,'contact');await serial(`${c.numberId}:messages`,async()=>{const current=await get(run.companyId,c.id,'contact');if(current.activeFlowId===run.id)await put(run.companyId,'contact',{...current,activeFlowId:null},c.id);});
 }
 async function start(cid,contact,rule,manual,text='',staffId=null){
  return serial(`flow:${idFor(cid,'active-flow',contact.id)}`,()=>serial(`${contact.numberId}:messages`,async()=>{
   const c=await get(cid,contact.id,'contact'),co=await companyById(cid),old=await readRun(cid,c.id);
   if(co.settings.usageMode==='personal')throw fail(400,'Os fluxos de atendimento ficam no modo Para empresa.');
   if(staffId){const employee=await get(cid,staffId,'employee');if(employee.active===false||!co.settings.teamEnabled||c.assignedTo!==staffId)throw fail(403,'Este atendimento não está mais atribuído a você.');}
   if(c.isGroup||c.redirectTo||c.optOut||c.attendanceStatus==='closed')throw fail(400,'Este contato não está disponível para iniciar um fluxo.');
   if(active(old||{}))throw fail(409,'Já existe um fluxo em andamento neste contato.');
   if(!rule.enabled||rule.deleted)throw fail(400,'Ative o fluxo antes de iniciar.');
   if(!manual&&(!co.settings.autoReply||c.paused||c.assignedTo||old&&Date.now()-Date.parse(old.startedAt)<rule.cooldownMinutes*60000))return null;
   const startedAt=new Date().toISOString(),executionId=randomUUID(),id=idFor(cid,'active-flow',c.id),run={id,executionId,companyId:cid,contactId:c.id,contactName:c.name,ruleId:rule.id,ruleName:rule.name,flow:rule.flow,nodeId:rule.flow.nodes.find(n=>n.type==='start').id,status:'ready',startedAt,dueAt:startedAt,lastText:text,manual,staffId,steps:0,revision:randomUUID()};
   await put(cid,'flow-run',run,id);await put(cid,'contact',{...c,activeFlowId:id},c.id);await audit(cid,`Fluxo “${rule.name}” iniciado para ${c.name}.`,'flow',null,c.id);return run;
  }));
 }
 async function incoming(cid,contact,message){
  const previous=await readRun(cid,contact.id);if(contact.optOut){if(previous&&active(previous))await serial(`flow:${previous.id}`,()=>finish(previous,'cancelled','O contato pediu para parar.'));return true;}
  if(previous&&active(previous)){
   await serial(`flow:${previous.id}`,async()=>{
    const run=await readRun(cid,contact.id);if(!run||!active(run))return;
    if(run.status==='waiting'&&(message.receivedAt||message.at)>=(run.waitStartedAt||run.startedAt))await save(run,{status:'ready',nodeId:nextNode(run.flow,run.nodeId,'reply'),lastText:message.text,dueAt:new Date().toISOString(),waitStartedAt:null});
    else await save(run,{lastText:message.text});
   });return true;
  }
  const co=await companyById(cid);if(co.settings.usageMode==='personal'||!co.settings.autoReply||contact.paused||contact.assignedTo||contact.isGroup||contact.optOut)return false;
  const rules=(await rows(cid,'flow-rule')).filter(r=>r.enabled&&!r.deleted&&r.trigger==='incoming'&&(!r.numberId||r.numberId===contact.numberId)&&matches(r.matchMode,r.keywords,message.text)).sort((a,b)=>a.priority-b.priority);
  for(const rule of rules){if(await start(cid,contact,rule,false,message.text))return true;}return false;
 }
 async function runOne(snapshot){
  return serial(`flow:${snapshot.id}`,async()=>{
   let run=await get(snapshot.companyId,snapshot.id,'flow-run');if(!['ready','waiting'].includes(run.status)||Date.parse(run.dueAt)>Date.now())return;
   const co=await companyById(run.companyId),contact=await get(run.companyId,run.contactId,'contact'),rule=await get(run.companyId,run.ruleId,'flow-rule');
   if(!rule.enabled||rule.deleted||!canContinue(co,contact,run)){await finish(run,'cancelled','Interrompido por pausa, atendimento humano ou alteração de acesso.');return;}
   if(run.staffId){const employee=await get(run.companyId,run.staffId,'employee');if(employee.active===false||!co.settings.teamEnabled||contact.assignedTo!==run.staffId){await finish(run,'cancelled','O responsável pelo atendimento mudou.');return;}}
   if(run.status==='waiting'){run=await save(run,{status:'ready',nodeId:nextNode(run.flow,run.nodeId,'timeout'),dueAt:new Date().toISOString()});}
   if(!run.nodeId){await finish(run,'done');return;}
   const node=run.flow.nodes.find(n=>n.id===run.nodeId);if(!node||run.steps>=120){await finish(run,'needs_review','Fluxo inválido ou limite de etapas.');return;}
   const step={steps:run.steps+1};
   if(node.type==='end'){await finish(run,'done');return;}
   if(node.type==='handoff'){
    await serial(`${contact.numberId}:messages`,async()=>{const current=await get(run.companyId,contact.id,'contact');await put(run.companyId,'contact',{...current,paused:true,activeFlowId:null,attendanceStatus:current.assignedTo?'active':'waiting'},contact.id);});await finish(run,'done');await audit(run.companyId,`Fluxo “${run.ruleName}” encaminhou ${contact.name} para atendimento humano.`,'attendance',null,contact.id);return;
   }
   if(node.type==='delay'){await save(run,{...step,nodeId:nextNode(run.flow,node.id),dueAt:new Date(Date.now()+node.data.minutes*60000).toISOString()});return;}
   if(node.type==='reply'){await save(run,{...step,status:'waiting',waitStartedAt:new Date().toISOString(),dueAt:new Date(Date.now()+node.data.minutes*60000).toISOString()});return;}
   if(node.type==='condition'){await save(run,{...step,nodeId:nextNode(run.flow,node.id,matches(node.data.mode,node.data.keywords,run.lastText)?'yes':'no'),dueAt:new Date().toISOString()});return;}
   if(node.type==='start'){await save(run,{...step,nodeId:nextNode(run.flow,node.id),dueAt:new Date().toISOString()});return;}
   // Claim before side effects; a restart cannot replay an ambiguous submission.
   run=await save(run,{status:'sending',sendingNodeId:node.id});
   const guard=async()=>{const [current,latestCo,latestRun,latestRule]=await Promise.all([get(run.companyId,contact.id,'contact'),companyById(run.companyId),get(run.companyId,run.id,'flow-run'),get(run.companyId,run.ruleId,'flow-rule')]);if(latestRun.revision!==run.revision||latestRun.status!=='sending'||!latestRule.enabled||latestRule.deleted||!canContinue(latestCo,current,run))return false;if(run.staffId){const e=await get(run.companyId,run.staffId,'employee');if(e.active===false||!latestCo.settings.teamEnabled||current.assignedTo!==run.staffId)return false;}return true;};
   try{
    let input,agentId=null;
    if(node.type==='text')input={text:renderText(node.data.text,contact.name)};
    if(node.type==='audio'){const clip=await get(run.companyId,node.data.clipId,'audio-clip'),media=await get(run.companyId,clip.mediaId,'media');input={type:'audio',base64:media.base64,mime:media.mime};}
    if(node.type==='ai'){
     const a=await get(run.companyId,node.data.agentId,'agent');const historyResult=await db.from('startsys_records').select('data').eq('company_id',run.companyId).eq('kind','message').in('data->>contactId',[contact.id,...(contact.mergedContactIds||[])]).order('data->>at',{ascending:false}).limit(30);if(historyResult.error)throw fail(503,'Histórico indisponível.');
     const result=await agentReply(co,{...a,rules:`${a.rules||''}\nInstrução desta etapa: ${node.data.instruction}`},historyResult.data.reverse().map(r=>r.data),contact);
     if(result.stop){await serial(`${contact.numberId}:messages`,async()=>{const current=await get(run.companyId,contact.id,'contact');await put(run.companyId,'contact',{...current,optOut:true,paused:true},contact.id);});await finish(run,'cancelled','O contato pediu para parar.');return;}
     if(result.needsApproval){await finish(run,'needs_review','A IA solicitou revisão humana.');return;}input={text:result.reply};agentId=a.id;
    }
    if(!input)throw Error('Bloco inválido');const sent=await send(run.companyId,contact,{...input,staffId:run.staffId,flowId:run.ruleId,flowRunId:run.executionId},agentId,null,guard);if(!sent){await finish(run,'cancelled','Conversa alterada antes do envio.');return;}
    await save(run,{...step,status:'ready',nodeId:nextNode(run.flow,node.id),lastMessageId:sent.id,dueAt:new Date().toISOString(),sendingNodeId:null});
   }catch(e){await finish(run,'needs_review',e.status?e.message:'Envio não confirmado. Confira a conversa antes de reiniciar.');}
  });
 }
 app.get('/audio-clips',async(req,res)=>res.json(await rows(req.company.id,'audio-clip')));
 app.post('/audio-clips',async(req,res)=>{
  const cid=req.company.id,name=String(req.body.name||'').trim().slice(0,150);if(!name)throw fail(400,'Dê um nome ao áudio.');if((await rows(cid,'audio-clip',501)).length>=500)throw fail(400,'Limite de 500 áudios salvos.');
  let bytes;if(req.body.messageId){const message=await get(cid,req.body.messageId,'message');if(message.type!=='audio'||!message.mediaId)throw fail(400,'Selecione um áudio disponível.');bytes=Buffer.from((await get(cid,message.mediaId,'media')).base64,'base64');}else bytes=Buffer.from(String(req.body.base64||''),'base64');
  let voice;try{voice=await prepareVoiceAudio(bytes,ffmpeg);}catch(e){throw fail(422,e.message);}const id=randomUUID(),mediaId=idFor(cid,'audio-clip-media',id);
  await put(cid,'media',{base64:voice.audio.toString('base64'),mime:voice.mimetype,filename:'audio.ogg'},mediaId);res.json(await put(cid,'audio-clip',{name,mediaId,seconds:voice.seconds,size:voice.audio.length},id));
 });
 app.delete('/audio-clips/:id',async(req,res)=>{const cid=req.company.id;await get(cid,req.params.id,'audio-clip');if((await rows(cid,'flow-rule')).some(r=>!r.deleted&&r.flow?.nodes?.some(n=>n.type==='audio'&&n.data.clipId===req.params.id)))throw fail(409,'Remova este áudio dos fluxos antes de excluir.');const {error}=await db.from('startsys_records').delete().eq('company_id',cid).eq('kind','audio-clip').eq('id',req.params.id);if(error)throw fail(503,'Não foi possível excluir.');res.json({ok:true});});
 app.get('/flows',async(req,res)=>{const cid=req.company.id;res.json({rules:(await rows(cid,'flow-rule')).filter(r=>!r.deleted),runs:[...(await rows(cid,'flow-run',80)).filter(active),...await rows(cid,'flow-history',80)].map(({flow,revision,...r})=>r),clips:await rows(cid,'audio-clip')});});
 app.get('/flows/catalog',async(req,res)=>res.json((await rows(req.company.id,'flow-rule')).filter(r=>r.enabled&&!r.deleted).map(r=>({id:r.id,name:r.name}))));
 app.post('/flows',async(req,res)=>{
  if(req.company.settings.usageMode==='personal')throw fail(400,'Os fluxos de atendimento ficam no modo Para empresa.');const cid=req.company.id,input=req.body,flow=input.flow,error=validateFlow(flow);if(error)throw fail(400,error);
  const name=String(input.name||'').trim().slice(0,150);if(!name)throw fail(400,'Dê um nome ao fluxo.');if(input.id)await get(cid,input.id,'flow-rule');if(input.numberId)await get(cid,input.numberId,'number');
  for(const n of flow.nodes){if(n.type==='audio')await get(cid,n.data.clipId,'audio-clip');if(n.type==='ai'){const agent=await get(cid,n.data.agentId,'agent');if(!agent.encryptedKey)throw fail(400,'Configure uma chave no agente usado pelo fluxo.');}}
  if(!['manual','incoming'].includes(input.trigger)||!['any','contains','exact'].includes(input.matchMode))throw fail(400,'Gatilho inválido.');if(input.matchMode!=='any'&&!String(input.keywords||'').trim())throw fail(400,'Preencha as palavras do gatilho.');
  res.json(await put(cid,'flow-rule',{name,flow,enabled:input.enabled===true,trigger:input.trigger,numberId:String(input.numberId||''),matchMode:input.matchMode,keywords:String(input.keywords||'').slice(0,1000),priority:Math.max(1,Math.min(1000,Number(input.priority)||100)),cooldownMinutes:Math.max(1,Math.min(43200,Number(input.cooldownMinutes)||1440))},input.id||randomUUID()));
 });
 app.delete('/flows/:id',async(req,res)=>{const r=await get(req.company.id,req.params.id,'flow-rule');await put(req.company.id,'flow-rule',{...r,enabled:false,deleted:true},r.id);res.json({ok:true});});
 app.post('/flows/:id/start',async(req,res)=>{const cid=req.company.id,c=await get(cid,req.body.contactId,'contact'),rule=await get(cid,req.params.id,'flow-rule');if(rule.numberId&&rule.numberId!==c.numberId)throw fail(400,'O fluxo pertence a outro WhatsApp.');res.json(await start(cid,c,rule,true,'',req.employee?.id||null));});
 app.post('/flow-runs/:id/cancel',async(req,res)=>{const run=await get(req.company.id,req.params.id,'flow-run');await serial(`flow:${run.id}`,()=>finish(run,'cancelled','Cancelado pelo administrador.'));res.json({ok:true});});
 let running=false;async function tick(){if(running)return;running=true;try{
  const now=new Date().toISOString();const {data,error}=await db.from('startsys_records').select('*').eq('kind','flow-run').in('data->>status',['ready','waiting']).lte('data->>dueAt',now).order('updated_at').limit(40);if(error)return;
  for(const row of data)try{await runOne({...row.data,id:row.id,companyId:row.company_id});}catch{await audit(row.company_id,'Fluxo interrompido. Revise o histórico de execuções.','warning').catch(()=>{});}
  // Ambiguous sends from a previous process are review-only, never retried automatically.
  const stale=await db.from('startsys_records').select('*').eq('kind','flow-run').eq('data->>status','sending').lt('updated_at',new Date(Date.now()-5*60000).toISOString()).limit(20);
  for(const row of stale.data||[])await serial(`flow:${row.id}`,async()=>{const current=await get(row.company_id,row.id,'flow-run');if(current.status==='sending'&&Date.parse(current.updatedAt)<Date.now()-5*60000)await finish({...current,companyId:row.company_id},'needs_review','O serviço reiniciou durante um envio. Confira antes de executar novamente.');});
 }catch{console.warn('STARSIS flow cycle interrupted');}finally{running=false;}}
 if(deps.startTimer!==false)setInterval(tick,1000).unref();
 const cancelContact=async(cid,contactId,reason='Interrompido por atendimento humano.')=>serial(`flow:${idFor(cid,'active-flow',contactId)}`,async()=>{const run=await readRun(cid,contactId);if(run&&active(run))await finish(run,'cancelled',reason);});
 return {incoming,start,runOne,tick,cancelContact};
}
