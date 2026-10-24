import {randomUUID,randomInt,randomBytes,createHmac} from 'node:crypto';
import {hashPassword,verifyPassword,tokenHash} from './auth.js';
import {staffVisible,staffCanReply,safeEmployee,attendanceColumn} from './team-policy.js';
export const STAFF_DOMAIN='@staff.startsys.invalid';
export function createTeam(deps){
 const {db,get,put,rows,fail,serial,companyById,audit,secret}=deps;
 let cancelFlow=async()=>{};
 const fingerprint=password=>createHmac('sha256',secret).update('employee-login:'+password).digest('hex');
 async function identify(account){
  if(!String(account.email||'').endsWith(STAFF_DOMAIN))return null;
  const {data,error}=await db.from('startsys_records').select('id,company_id,data').eq('kind','employee').eq('data->>accountId',account.id).maybeSingle();
  if(error)throw fail(503,'Não foi possível verificar seu acesso.');if(!data||data.data.active===false)throw fail(401,'Seu acesso de funcionário foi desativado.');
  const company=await companyById(data.company_id);if(!company.settings.teamEnabled||company.settings.usageMode==='personal')throw fail(403,'O acesso da equipe está desabilitado.');
  return {employee:{...data.data,id:data.id},company};
 }
 async function login(input){
  const code=String(input.companyCode||'').trim(),password=String(input.password||'');if(!/^\d{4}$/.test(code)||password.length<10||password.length>200)throw fail(401,'Código da empresa ou senha incorretos.');
  const {data:link,error}=await db.from('startsys_records').select('company_id').eq('kind','team-code').eq('id',`team-code:${code}`).maybeSingle();if(error)throw fail(503,'Não foi possível entrar agora.');
  if(!link)throw fail(401,'Código da empresa ou senha incorretos.');
  const {data:record}=await db.from('startsys_records').select('data').eq('company_id',link.company_id).eq('kind','employee').eq('data->>loginFingerprint',fingerprint(password)).maybeSingle();
  const {data:account}=await db.from('startsys_accounts').select('*').eq('id',record?.data?.accountId||'00000000-0000-0000-0000-000000000000').maybeSingle();
  if(!account||!await verifyPassword(password,account.password_hash))throw fail(401,'Código da empresa ou senha incorretos.');
  await identify(account);return account;
 }
 async function codeFor(cid){
  return serial(`team-code:${cid}`,async()=>{
   const {data,error}=await db.from('startsys_records').select('data').eq('company_id',cid).eq('kind','team-code').maybeSingle();if(error)throw fail(503,'Não foi possível consultar o código.');if(data)return data.data.code;
   for(let i=0;i<30;i++){const code=String(randomInt(10000)).padStart(4,'0');const {error}=await db.from('startsys_records').insert({id:`team-code:${code}`,company_id:cid,kind:'team-code',data:{code}});if(!error)return code;if(error.code!=='23505')throw fail(503,'Não foi possível gerar o código da empresa.');const existing=await db.from('startsys_records').select('data').eq('company_id',cid).eq('kind','team-code').maybeSingle();if(existing.data)return existing.data.data.code;}
   throw fail(503,'Não foi possível reservar um código agora.');
  });
 }
 async function employees(cid){return (await rows(cid,'employee',200)).map(safeEmployee);}
 async function owned(req,id,reply=false){
  let c=await get(req.company.id,id,'contact');if(c.redirectTo)c=await get(req.company.id,c.redirectTo,'contact');if(req.employee&&!(reply==='history'?c.assignedTo===req.employee.id:reply?staffCanReply(req.employee,c):staffVisible(req.employee,c)))throw fail(403,'Este atendimento não está atribuído a você.');return c;
 }
 async function canSend(req,id){if(!req.employee)return true;const [company,employee]=await Promise.all([companyById(req.company.id),get(req.company.id,req.employee.id,'employee')]);if(!company.settings.teamEnabled||company.settings.usageMode==='personal'||employee.active===false)throw fail(403,'O acesso da equipe foi desativado.');await owned(req,id,true);return true;}
 async function mediaAccess(req,id){
  const cid=req.company.id;
  const shared=await db.from('startsys_records').select('id').eq('company_id',cid).in('kind',['sticker','audio-clip']).eq('data->>mediaId',id).limit(1);if(shared.error)throw fail(503,'Não foi possível verificar o anexo.');if(shared.data?.length)return;
  const {data,error}=await db.from('startsys_records').select('data').eq('company_id',cid).eq('kind','message').eq('data->>mediaId',id).limit(1);if(error)throw fail(503,'Não foi possível verificar o anexo.');if(!data?.length)throw fail(403,'Anexo não disponível para este atendimento.');await owned(req,data[0].data.contactId,'history');
 }
 async function gate(req,res,next){
  if(!req.employee)return next();const cid=req.employeeCompany.id;req.company=req.employeeCompany;
  const path=req.path,method=req.method;
  if(method==='GET'&&path==='/bootstrap'){
   const [contacts,stickers,directory]=await Promise.all([rows(cid,'contact'),rows(cid,'sticker'),employees(cid)]);
   return res.json({company:{id:cid,name:req.company.name,settings:{teamEnabled:true,usageMode:'company',timezone:req.company.settings.timezone}},contacts:contacts.filter(c=>staffVisible(req.employee,c)).map(c=>({...c,...(!c.assignedTo?{notes:'',email:'',business:'',tags:'',mergedContactIds:[]}:{} )})),stickers,employees:directory,agents:[],numbers:[],automations:[],meetings:[],activity:[]});
  }
  if(method==='GET'&&['/team/directory','/flows/catalog','/audio-clips'].includes(path)||method==='POST'&&path==='/team/password')return next();
  const contactRoute=path.match(/^\/contacts\/([^/]+)\/(messages|read)$/);
  if(contactRoute&&((method==='GET'&&contactRoute[2]==='messages')||(method==='POST'&&contactRoute[2]==='read'))){await owned(req,contactRoute[1],'history');return next();}
  if(method==='POST'&&path==='/send'){await owned(req,String(req.body.contactId||''),true);return next();}
  if(method==='POST'&&/^\/team\/contacts\/[^/]+\/(claim|transfer|status)$/.test(path))return next();
  if(method==='GET'&&path.startsWith('/media/')){await mediaAccess(req,decodeURIComponent(path.slice(7)));return next();}
  if(method==='POST'&&/^\/flows\/[^/]+\/start$/.test(path)){await owned(req,String(req.body.contactId||''),true);return next();}
  if(['PATCH','DELETE'].includes(method)&&/^\/messages\/[^/]+$/.test(path)){const m=await get(cid,path.slice(10),'message');await owned(req,m.contactId,true);if(m.staffId!==req.employee.id)throw fail(403,'Você só pode alterar mensagens enviadas por você.');return next();}
  throw fail(403,'Esta área está disponível somente para o administrador.');
 }
 async function onIncoming(cid,c){
  const co=await companyById(cid);if(!co.settings.teamEnabled)return c;
  if(c.attendanceStatus==='closed'){c.assignedTo=null;c.attendanceStatus='waiting';c.closedAt=null;c.attendanceStartedAt=null;}
  else c.attendanceStatus=c.assignedTo?'active':'waiting';
  return c;
 }
 function install(app){
  app.get('/team',async(req,res)=>res.json({code:await codeFor(req.company.id),enabled:!!req.company.settings.teamEnabled,employees:await employees(req.company.id)}));
  app.get('/team/directory',async(req,res)=>res.json((await employees(req.company.id)).filter(e=>e.active)));
  app.post('/team/employees',async(req,res)=>{
   if(!req.company.settings.teamEnabled||req.company.settings.usageMode==='personal')throw fail(400,'Habilite o atendimento com equipe nas configurações.');
   const name=String(req.body.name||'').trim().slice(0,120);if(name.length<2)throw fail(400,'Informe o nome do funcionário.');
   if((await rows(req.company.id,'employee',201)).length>=200)throw fail(400,'Limite de 200 funcionários por empresa.');
   const password=randomBytes(12).toString('base64url'),id=randomUUID();
   const {data,error}=await db.from('startsys_accounts').insert({email:id+STAFF_DOMAIN,full_name:name,password_hash:await hashPassword(password)}).select().single();if(error)throw fail(503,'Não foi possível criar o acesso.');
   try{await put(req.company.id,'employee',{name,accountId:data.id,active:true,loginFingerprint:fingerprint(password)},id);}catch(e){await db.from('startsys_accounts').delete().eq('id',data.id);throw e;}
   await audit(req.company.id,`Acesso criado para ${name}.`,'team');res.json({employee:{id,name,active:true},companyCode:await codeFor(req.company.id),password});
  });
  app.post('/team/employees/:id/reset',async(req,res)=>serial(`employee-password:${req.params.id}`,async()=>{
   const e=await get(req.company.id,req.params.id,'employee'),password=randomBytes(12).toString('base64url');
   const {error}=await db.from('startsys_accounts').update({password_hash:await hashPassword(password)}).eq('id',e.accountId);if(error)throw fail(503,'Não foi possível redefinir a senha.');
   await put(req.company.id,'employee',{...e,loginFingerprint:fingerprint(password)},e.id);await db.from('startsys_sessions').delete().eq('account_id',e.accountId);await audit(req.company.id,`Senha de ${e.name} redefinida; sessões encerradas.`,'team');res.json({password,companyCode:await codeFor(req.company.id)});
  }));
  app.patch('/team/employees/:id',async(req,res)=>{
   const e=await get(req.company.id,req.params.id,'employee');if(typeof req.body.active==='boolean')e.active=req.body.active;if(typeof req.body.name==='string'&&req.body.name.trim().length>=2)e.name=req.body.name.trim().slice(0,120);
   await put(req.company.id,'employee',e,e.id);if(!e.active){await db.from('startsys_sessions').delete().eq('account_id',e.accountId);for(const contact of await rows(req.company.id,'contact'))if(contact.assignedTo===e.id&&contact.attendanceStatus!=='closed')await serial(`${contact.numberId}:messages`,async()=>{const current=await get(req.company.id,contact.id,'contact');if(current.assignedTo===e.id&&current.attendanceStatus!=='closed')await put(req.company.id,'contact',{...current,assignedTo:null,attendanceStatus:'waiting',paused:true,activeFlowId:null},current.id);cancelFlow(req.company.id,current.id).catch(()=>{});});}res.json(safeEmployee(e));
  });
  app.post('/team/password',async(req,res)=>serial(`employee-password:${req.employee?.id}`,async()=>{
   if(!req.employee)throw fail(400,'Entre como funcionário.');const {data:a}=await db.from('startsys_accounts').select('*').eq('id',req.employee.accountId).single();
   if(!await verifyPassword(req.body.current,a?.password_hash))throw fail(400,'Senha atual incorreta.');const password=String(req.body.password||''),hash=await hashPassword(password).catch(e=>{throw fail(400,e.message);});
   const duplicate=await db.from('startsys_records').select('id').eq('company_id',req.company.id).eq('kind','employee').eq('data->>loginFingerprint',fingerprint(password)).neq('id',req.employee.id).limit(1);if(duplicate.error)throw fail(503,'Não foi possível verificar a senha.');if(duplicate.data.length)throw fail(400,'Escolha outra senha.');
   const {error}=await db.from('startsys_accounts').update({password_hash:hash}).eq('id',a.id);if(error)throw fail(503,'Não foi possível salvar a senha.');const current=await get(req.company.id,req.employee.id,'employee');try{await put(req.company.id,'employee',{...current,loginFingerprint:fingerprint(password)},req.employee.id);}catch(error){await db.from('startsys_accounts').update({password_hash:a.password_hash}).eq('id',a.id);throw error;}await db.from('startsys_sessions').delete().eq('account_id',a.id).neq('token_hash',req.sessionHash);res.json({ok:true});
  }));
  for(const action of ['claim','transfer','status'])app.post(`/team/contacts/:id/${action}`,async(req,res)=>{
   const initial=await get(req.company.id,req.params.id,'contact');return serial(`${initial.numberId}:messages`,async()=>{
    const c=await get(req.company.id,initial.id,'contact');if(c.redirectTo)throw fail(409,'Este contato foi unificado. Atualize a tela.');
    if(action==='claim'){
     if(req.employee&&c.assignedTo&&c.assignedTo!==req.employee.id)throw fail(409,'Outro funcionário já assumiu este atendimento.');
     const target=req.employee?.id||String(req.body.employeeId||'');if(!target)throw fail(400,'Escolha o funcionário responsável.');const employee=await get(req.company.id,target,'employee');if(employee.active===false)throw fail(400,'Funcionário inativo.');c.assignedTo=target;c.attendanceStatus='active';c.attendanceStartedAt=new Date().toISOString();c.closedAt=null;c.paused=true;
    }else{
     if(req.employee&&!(staffCanReply(req.employee,c)||action==='status'&&req.body.status==='active'&&c.assignedTo===req.employee.id))throw fail(403,'Este atendimento não está atribuído a você.');
     if(action==='transfer'){const target=String(req.body.employeeId||'');const employee=await get(req.company.id,target,'employee');if(employee.active===false)throw fail(400,'Funcionário inativo.');c.assignedTo=target;c.attendanceStatus='active';c.paused=true;}
     else{if(!['active','replied','closed','waiting'].includes(req.body.status))throw fail(400,'Status inválido.');c.attendanceStatus=req.body.status;if(req.body.status==='closed'){c.closedAt=new Date().toISOString();c.paused=true;}if(req.body.status==='waiting'){c.assignedTo=null;c.paused=true;}}
    }
    c.activeFlowId=null;await put(req.company.id,'contact',c,c.id);cancelFlow(req.company.id,c.id).catch(()=>{});await audit(req.company.id,`${req.employee?.name||'Administrador'}: atendimento de ${c.name} ${action==='transfer'?'transferido':action==='claim'?'assumido':c.attendanceStatus==='closed'?'finalizado':'atualizado'}.`,'attendance',null,c.id);res.json(c);
   });
  });
 }
 return {identify,login,gate,install,codeFor,employees,owned,canSend,onIncoming,setFlowControl:fn=>{cancelFlow=fn;}};
}
