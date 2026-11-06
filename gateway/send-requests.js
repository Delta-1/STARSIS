// A slow WhatsApp acknowledgement must not tie up the HTTP request or trigger a resend.
export function installSendRequests(app,{get,put,serial,idFor,fail,send,team,flows,personalMode,timeoutMs=8000}){
 const keyFor=(cid,key)=>{if(!/^[\w-]{16,100}$/.test(key))throw fail(400,'Identificador de envio inválido.');return idFor(cid,'request',key);};
 app.get('/send/:key',async(req,res)=>{
  const cid=req.company.id,record=await get(cid,keyFor(cid,req.params.key),'request');
  await team.owned(req,record.contactId,'history');
  res.json({status:record.status,error:record.error,...(record.messageId?{message:await get(cid,record.messageId,'message')}:{})});
 });
 app.post('/send',async(req,res)=>{
  const cid=req.company.id,key=String(req.body.requestId||''),id=keyFor(cid,key),contact=await get(cid,req.body.contactId,'contact'),started=Date.now();
  const job=serial(id,async()=>{
   let existing;
   try{existing=await get(cid,id,'request');}catch(error){if(error.status!==404)throw error;}
   if(existing){
    if(existing.contactId&&existing.contactId!==contact.id)throw fail(409,'Identificador usado em outra conversa.');
    if(existing.messageId)return await get(cid,existing.messageId,'message');
    return {status:existing.status,requestId:key,error:existing.error};
   }
   await put(cid,'request',{status:'sending',contactId:contact.id},id);
   try{
    await serial(`${contact.numberId}:messages`,async()=>{
     await team.canSend(req,contact.id);
     const current=await get(cid,contact.id,'contact');current.lastManualReplyAt=new Date().toISOString();current.activeFlowId=null;
     if(!personalMode(req.company))current.paused=true;
     await put(cid,'contact',current,current.id);
    });
    flows.cancelContact(cid,contact.id).catch(()=>{});
    const result=await send(cid,contact,{...req.body,staffId:req.employee?.id||null,operatorName:req.employee?.name||req.account.full_name,flowId:null,flowRunId:null},null,null,()=>team.canSend(req,contact.id));
    if(!result)throw fail(409,'O atendimento mudou de responsável.');
    await put(cid,'request',{status:'sent',contactId:contact.id,messageId:result.id},id);
    console.info('STARSIS send completed',{durationMs:Date.now()-started,type:result.type});
    return result;
   }catch(error){
    const uncertain=!!error.submissionStarted;
    await put(cid,'request',{status:uncertain?'uncertain':'failed',contactId:contact.id,error:uncertain?'Confirmação pendente. Confira o WhatsApp antes de reenviar.':error.status?error.message:'Falha antes do envio. Tente novamente.'},id).catch(()=>{});
    if(uncertain)return {status:'uncertain',requestId:key,error:'Confirmação pendente. Confira o WhatsApp antes de reenviar.'};
    throw error;
   }
  });
  let timer;
  try{
   const result=await Promise.race([job,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'sending',requestId:key}),timeoutMs);})]);
   res.status(result.status?202:200).json(result);
  }finally{clearTimeout(timer);}
 });
}
