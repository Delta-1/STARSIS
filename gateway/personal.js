import {randomUUID} from 'node:crypto';
import {personalMode,replyDelay,stillUnanswered,needsPersonalApproval,ownerPhone} from './personal-domain.js';
import {askPrivateAssistant} from './private-assistant.js';
export function installPersonal(app,deps){
 const {db,get,put,rows,send,connected,crypt,fail,idFor,serial,maybeReply,companyById,generateMessageIDV2}=deps;
 async function report(cid,days=7){
  const since=new Date(Date.now()-Math.max(1,Math.min(90,days))*86400000).toISOString();let messages=[],total=0;
  for(let page=0;page<10;page++){
   const {data,error,count}=await db.from('startsys_records').select('id,data,created_at',{count:'exact'}).eq('company_id',cid).eq('kind','message').gte('data->>at',since).order('data->>at',{ascending:false}).range(page*1000,page*1000+999);
   if(error)throw fail(503,'Não foi possível preparar o relatório.');total=count||0;messages.push(...data.map(r=>({...r.data,id:r.id})));if(data.length<1000)break;
  }
  const contacts=(await rows(cid,'contact')).filter(c=>!c.redirectTo),sent=messages.filter(m=>m.direction==='out'),daily={};
  for(const m of messages){const date=String(m.at||'').slice(0,10);daily[date]??={date,incoming:0,sent:0,bot:0};if(m.direction==='in')daily[date].incoming++;else{daily[date].sent++;if(m.agentId)daily[date].bot++;}}
  return {since,total,truncated:total>messages.length,incoming:messages.length-sent.length,sent:sent.length,bot:sent.filter(m=>m.agentId).length,manual:sent.filter(m=>!m.agentId).length,daily:Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date)),unanswered:contacts.filter(c=>!c.isGroup&&c.lastDirection==='in'&&Date.parse(c.lastAt)<Date.now()-120000).map(c=>({id:c.id,name:c.name,phone:c.phone,lastAt:c.lastAt,lastMessage:c.lastMessage})),recent:messages.slice(0,80).map(m=>({...m,contactName:contacts.find(c=>c.id===m.contactId)?.name||'Contato'}))};
 }
 async function overview(cid){
  const [approvals,events,notifications,messages]=await Promise.all(['approval','event','notification','assistant-message'].map(k=>rows(cid,k,k==='assistant-message'?100:300)));
  return {approvals:approvals.filter(a=>a.status==='pending'),events:events.filter(e=>e.status!=='cancelled').sort((a,b)=>a.at.localeCompare(b.at)),notifications:notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),messages:messages.reverse()};
 }
 async function notifyOwner(co,title,text,reference,id=randomUUID()){
  const previous=await db.from('startsys_records').select('id').eq('company_id',co.id).eq('id',id).eq('kind','notification').maybeSingle();if(previous.data)return;
  await put(co.id,'notification',{title,text,reference,read:false},id);
  const phone=ownerPhone(co.settings);if(!co.settings.notifyOwnerWhatsApp||phone.length<8)return;
  try{
   const numbers=await rows(co.id,'number'),number=numbers.find(n=>n.id===co.settings.notificationNumberId)||numbers.find(n=>n.connectRequested);if(!number)return;
   const session=connected(number.id),outboundId=generateMessageIDV2(session.sock.user?.id);session.outboundIds??=new Set();session.outboundIds.add(outboundId);if(session.outboundIds.size>1000)session.outboundIds.delete(session.outboundIds.values().next().value);const sent=await session.sock.sendMessage(`${phone}@s.whatsapp.net`,{text:`StartSys · ${title}\n\n${text}\n\nhttps://delta-1.github.io/STARSIS/#assistente`},{messageId:outboundId});
   session.outboundIds??=new Set();if(sent?.key?.id)session.outboundIds.add(sent.key.id);
  }catch{await put(co.id,'activity',{text:'O aviso está no aplicativo. Não foi possível entregar a notificação no WhatsApp configurado.',type:'warning',at:new Date().toISOString()});}
 }
 async function context(co,text){
  const [summary,contacts,meetings,events]=await Promise.all([report(co.id,7),rows(co.id,'contact'),rows(co.id,'meeting'),rows(co.id,'event')]);
  const terms=text.toLowerCase().split(/\s+/).filter(t=>t.length>=3),relevant=contacts.filter(c=>!c.redirectTo).sort((a,b)=>terms.filter(t=>`${b.name} ${b.phone}`.toLowerCase().includes(t)).length-terms.filter(t=>`${a.name} ${a.phone}`.toLowerCase().includes(t)).length).slice(0,5);
  const histories=await Promise.all(relevant.map(async c=>{const {data,error}=await db.from('startsys_records').select('data').eq('company_id',co.id).eq('kind','message').in('data->>contactId',[c.id,...(c.mergedContactIds||[])]).order('data->>at',{ascending:false}).limit(16);if(error)throw fail(503,'Não foi possível consultar o histórico.');return {name:c.name,phone:c.phone,notes:c.notes,messages:data.reverse().map(r=>({direction:r.data.direction,text:r.data.text,at:r.data.at}))};}));
  return {owner:co.settings.ownerName||co.name,timezone:co.settings.timezone,report:summary,histories,meetings:meetings.filter(m=>m.status==='agendada'),events:events.filter(e=>e.status==='scheduled')};
 }
 async function chat(co,text,requestId){
  const key=idFor(co.id,'private-chat',requestId);
  return serial(key,async()=>{
   try{return await get(co.id,key,'assistant-message');}catch(e){if(e.status!==404)throw e;}
   const agents=await rows(co.id,'agent'),agent=agents.find(a=>a.id===co.settings.privateAgentId&&a.encryptedKey)||agents.find(a=>a.encryptedKey);
   if(!agent)throw fail(400,'Configure a chave de IA em um dos seus bots para conversar com o assistente. Ele pode ficar desativado no WhatsApp.');
   const incoming=await put(co.id,'assistant-message',{direction:'in',text,at:new Date().toISOString()},idFor(key,'question'));
   const history=(await rows(co.id,'assistant-message',30)).reverse();
   const result=await askPrivateAssistant(agent,crypt.open(agent.encryptedKey),history,await context(co,text));
   return put(co.id,'assistant-message',{direction:'out',text:result.reply,eventProposal:result.event,at:new Date().toISOString()},key);
  });
 }
 async function approve(co,id,text){
  return serial(`approval:${id}`,async()=>{
   const approval=await get(co.id,id,'approval');if(approval.status!=='pending')throw fail(409,'Este pedido já foi resolvido.');
   const contact=await get(co.id,approval.contactId,'contact');
   if(contact.lastInboundAt!==approval.sourceAt||contact.lastDirection==='out'||contact.optOut||contact.redirectTo){await put(co.id,'approval',{...approval,status:'cancelled'},id);throw fail(409,'A conversa mudou após este pedido. Revise o histórico antes de responder.');}
   const message=String(text||approval.reply).trim().slice(0,6000);if(!message)throw fail(400,'Escreva a resposta.');
   await put(co.id,'approval',{...approval,status:'sending'},id);
   try{await send(co.id,contact,{text:message},approval.agentId);await put(co.id,'approval',{...approval,status:'sent',reply:message},id);return {ok:true};}
   catch(e){await put(co.id,'approval',{...approval,status:'needs_review'},id);throw e;}
  });
 }
 app.get('/assistant/overview',async(req,res)=>res.json(await overview(req.company.id)));
 app.get('/reports',async(req,res)=>res.json(await report(req.company.id,Number(req.query.days)||7)));
 app.post('/assistant/chat',async(req,res)=>{const text=String(req.body.text||'').trim().slice(0,8000),key=String(req.body.requestId||'');if(!text||!/^[\w-]{16,100}$/.test(key))throw fail(400,'Escreva sua mensagem e tente novamente.');res.json(await chat(req.company,text,key));});
 app.post('/approvals/:id/approve',async(req,res)=>res.json(await approve(req.company,req.params.id,req.body.text)));
 app.post('/approvals/:id/reject',async(req,res)=>serial(`approval:${req.params.id}`,async()=>{const a=await get(req.company.id,req.params.id,'approval');if(a.status!=='pending')throw fail(409,'Este pedido já foi resolvido.');await put(req.company.id,'approval',{...a,status:'rejected'},a.id);res.json({ok:true});}));
 app.post('/notifications/:id/read',async(req,res)=>{const n=await get(req.company.id,req.params.id,'notification');await put(req.company.id,'notification',{...n,read:true},n.id);res.json({ok:true});});
 app.post('/events',async(req,res)=>{
  const title=String(req.body.title||'').trim().slice(0,200),date=Date.parse(req.body.at);if(!title||!Number.isFinite(date))throw fail(400,'Informe título e data válidos.');
  const at=new Date(date).toISOString();let proposalId;if(req.body.sourceMessageId){await get(req.company.id,req.body.sourceMessageId,'assistant-message');proposalId=idFor(req.company.id,'event-proposal',req.body.sourceMessageId);const existing=await db.from('startsys_records').select('id,data').eq('company_id',req.company.id).eq('id',proposalId).eq('kind','event').maybeSingle();if(existing.data)return res.json({...existing.data.data,id:existing.data.id});}const id=req.body.id;if(id)await get(req.company.id,id,'event');
  res.json(await put(req.company.id,'event',{title,at,notes:String(req.body.notes||'').slice(0,10000),status:req.body.status==='done'?'done':'scheduled'},id||proposalId||randomUUID()));
 });
 app.patch('/events/:id',async(req,res)=>{const event=await get(req.company.id,req.params.id,'event');if(!['done','cancelled','scheduled'].includes(req.body.status))throw fail(400,'Status inválido.');res.json(await put(req.company.id,'event',{...event,status:req.body.status},event.id));});
 async function requestApproval(co,agent,contact,incoming,result){
  if(!needsPersonalApproval(co,agent,result))return false;
  const id=idFor(co.id,'approval',incoming.id),code=id.slice(0,8).toUpperCase();
  await put(co.id,'approval',{contactId:contact.id,contactName:contact.name,agentId:agent.id,sourceAt:incoming.at,reply:result.reply,reason:String(result.approvalReason||'Este assunto precisa da sua confirmação.').slice(0,1000),status:'pending',code},id);
  await notifyOwner(co,'Preciso da sua aprovação',`${contact.name}: ${incoming.text.slice(0,500)}\n\nResposta sugerida: ${result.reply}\n\nRevise no aplicativo ou responda APROVAR ${code} neste WhatsApp.`,{type:'approval',id},idFor(id,'notice'));
  return true;
 }
 async function queue(cid,contact,incoming,mediaId){
  const co=await companyById(cid);
  const phone=ownerPhone(co?.settings);
  if(!contact.isGroup&&co?.settings.notifyOwnerWhatsApp&&phone&&contact.phone===phone){
   try{
    const command=incoming.text.trim().match(/^APROVAR\s+([A-F0-9]{8})$/i);
    if(command){const approvals=(await rows(cid,'approval')).filter(a=>a.status==='pending'&&a.code===command[1].toUpperCase());if(approvals.length===1)await approve(co,approvals[0].id);else throw fail(400,'Pedido de aprovação não encontrado.');}
    else{const result=await chat(co,incoming.text,incoming.id);await notifyOwner(co,'Seu assistente',result.text,null,idFor(incoming.id,'private-reply'));}
   }catch(e){await notifyOwner(co,'Confira no aplicativo',e.status?e.message:'Não foi possível responder agora.',null,idFor(incoming.id,'private-error'));}
   return true;
  }
  if(!personalMode(co))return false;
  if(!co.settings.autoReply||contact.paused||contact.optOut)return true;
  const agents=await rows(cid,'agent'),agent=deps.selectAgent(agents,contact);if(!agent)return true;
  await put(cid,'reply-job',{contactId:contact.id,incoming,mediaId,dueAt:new Date(Date.now()+replyDelay(agent,co)*1000).toISOString(),status:'pending'},idFor(cid,'reply-job',contact.id));return true;
 }
 let running=false;
 async function tick(){if(running)return;running=true;try{
  const {data,error}=await db.from('startsys_records').select('*').eq('kind','reply-job').eq('data->>status','pending').lte('data->>dueAt',new Date().toISOString()).limit(30);if(error)return;
  for(const row of data){
   const claimToken=randomUUID();
   const {data:claimed,error}=await db.from('startsys_records').update({data:{...row.data,status:'running',claimToken}}).eq('id',row.id).eq('company_id',row.company_id).eq('data->>status','pending').select('id');if(error||!claimed?.length)continue;
   try{const contact=await get(row.company_id,row.data.contactId,'contact'),co=await companyById(row.company_id);if(personalMode(co)&&stillUnanswered(contact,row.data))await maybeReply(row.company_id,contact,row.data.incoming,row.data.mediaId);await db.from('startsys_records').update({data:{...row.data,status:'done'}}).eq('id',row.id).eq('company_id',row.company_id).eq('data->>claimToken',claimToken);}catch{await db.from('startsys_records').update({data:{...row.data,status:'failed'}}).eq('id',row.id).eq('company_id',row.company_id).eq('data->>claimToken',claimToken);}
  }
  const {data:events}=await db.from('startsys_records').select('*').eq('kind','event').eq('data->>status','scheduled').gte('data->>at',new Date().toISOString()).lte('data->>at',new Date(Date.now()+5*60000).toISOString()).limit(30);
  for(const event of events||[]){const co=await companyById(event.company_id);await notifyOwner(co,'Compromisso em breve',`${event.data.title}\n${new Date(event.data.at).toLocaleString('pt-BR',{timeZone:co.settings.timezone||'America/Sao_Paulo'})}`,{type:'event',id:event.id},idFor(co.id,'event-reminder',event.id));}
 }catch{console.warn('StartSys personal assistant cycle interrupted');}finally{running=false;}}
 setInterval(()=>tick(),5000).unref();
 return {requestApproval,queue,report};
}
