import {randomUUID} from 'node:crypto';
import {hashPassword,newToken,tokenHash} from './auth.js';

export const isTrialAccount = account => String(account?.email || '').endsWith('@trial.startsys.invalid');
export function createTrials({db,company,put,rows,start,stateFor,stop,serial,fail}) {
  const lifetime = 24 * 60 * 60 * 1000;
  async function accountForToken(token) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) throw fail(401,'Teste expirado. Gere outro QR Code.');
    const {data,error} = await db.from('startsys_sessions').select('account_id,expires_at,startsys_accounts(id,email,full_name)').eq('token_hash',tokenHash(token)).maybeSingle();
    if(error || !data || Date.parse(data.expires_at) < Date.now() || !isTrialAccount(data.startsys_accounts)) throw fail(401,'Teste expirado. Gere outro QR Code.');
    const c = await company(data.account_id);
    if(!c || Date.parse(c.settings.trialExpiresAt) < Date.now()) throw fail(401,'O teste de 24 horas terminou.');
    return {account:data.startsys_accounts,company:c};
  }
  async function create() {
    const expiresAt = new Date(Date.now()+lifetime).toISOString();
    const {data:account,error} = await db.from('startsys_accounts').insert({email:randomUUID()+'@trial.startsys.invalid',full_name:'Visitante',password_hash:await hashPassword(newToken())}).select().single();
    if(error) throw fail(503,'Não foi possível iniciar o teste.');
    try {
      const {data:c,error} = await db.from('startsys_companies').insert({owner_id:account.id,name:'Meu WhatsApp',settings:{trial:true,trialExpiresAt:expiresAt,usageMode:'company',timezone:'America/Rio_Branco',autoReply:false,teamEnabled:false,workMode:'agents'}}).select().single();
      if(error) throw fail(503,'Não foi possível preparar seu espaço.');
      const n = await put(c.id,'number',{name:'WhatsApp principal',connectRequested:true,status:'disconnected'});
      start(c.id,n).catch(()=>{});
      return {account,expiresAt};
    } catch(e) {
      const c=await company(account.id).catch(()=>null);
      if(c) await db.from('startsys_companies').delete().eq('id',c.id);
      await db.from('startsys_accounts').delete().eq('id',account.id);
      throw e;
    }
  }
  async function status(token,reconnect=false) {
    const {company:c}=await accountForToken(token),numbers=await rows(c.id,'number');
    const n=numbers[0]; if(!n) throw fail(409,'Conexão temporária indisponível.');
    if(reconnect && stateFor(n.id).status!=='connected') await start(c.id,n);
    return {numberId:n.id,...stateFor(n.id),expiresAt:c.settings.trialExpiresAt};
  }
  async function validate(account) {
    if(!isTrialAccount(account)) return;
    const c=await company(account.id);
    if(!c || Date.parse(c.settings.trialExpiresAt)<Date.now()) throw fail(401,'Seu teste expirou. Entre ou crie sua conta.');
  }
  async function upgrade(token,values) {
    const initial=await accountForToken(token);
    return serial('trial-owner:'+initial.account.id,async()=>{
      const {account,company:c}=await accountForToken(token);
      const {companyName,...accountValues}=values;
      const {data,error}=await db.from('startsys_accounts').update(accountValues).eq('id',account.id).eq('email',account.email).select().single();
      if(error || !data) throw fail(409,'Este e-mail já está cadastrado. Entre na sua conta.');
      const settings={...c.settings,trial:false,ownerName:values.full_name,teamEnabled:true,workMode:'hybrid'};
      delete settings.trialExpiresAt;
      const result=await db.from('startsys_companies').update({name:companyName||c.name,settings}).eq('id',c.id).eq('owner_id',account.id);
      if(result.error) throw fail(503,'Conta criada. Entre novamente para continuar.');
      await db.from('startsys_sessions').delete().eq('account_id',account.id);
      return data;
    });
  }
  async function removeGuest({account,company:c}) {
    for(const n of await rows(c.id,'number')) await stop(n.id);
    const removed=await db.from('startsys_companies').delete().eq('id',c.id).eq('owner_id',account.id);
    if(removed.error) throw fail(503,'Não foi possível encerrar o teste.');
    await db.from('startsys_accounts').delete().eq('id',account.id).eq('email',account.email);
  }
  async function discard(token) {
    const initial=await accountForToken(token);
    return serial('trial-owner:'+initial.account.id,async()=>removeGuest(await accountForToken(token)));
  }
  async function adopt(account,token) {
    if(!token) return;
    let initial;try{initial=await accountForToken(token);}catch(e){if(e.status===401)return;throw e;}
    await serial('trial-owner:'+initial.account.id,async()=>{
      const guest=await accountForToken(token);
      if(await company(account.id)) { await removeGuest(guest); return; }
      const settings={...guest.company.settings,trial:false,ownerName:account.full_name,teamEnabled:true,workMode:'hybrid'};
      delete settings.trialExpiresAt;
      const result=await db.from('startsys_companies').update({owner_id:account.id,settings}).eq('id',guest.company.id).eq('owner_id',guest.account.id);
      if(result.error) throw fail(503,'Não foi possível guardar a conexão. Tente novamente.');
      await db.from('startsys_accounts').delete().eq('id',guest.account.id);
    });
  }
  async function cleanup() {
    const {data,error}=await db.from('startsys_companies').select('*').eq('settings->>trial','true').lt('settings->>trialExpiresAt',new Date().toISOString()).limit(100);
    if(error) return;
    for(const c of data||[]) await serial('trial-owner:'+c.owner_id,async()=>{
      const {data:a}=await db.from('startsys_accounts').select('*').eq('id',c.owner_id).maybeSingle();
      if(!isTrialAccount(a)) return;
      const current=await company(a.id);
      if(!current?.settings.trial || Date.parse(current.settings.trialExpiresAt)>=Date.now()) return;
      await removeGuest({account:a,company:current});
    });
  }

  return {create,status,validate,upgrade,adopt,discard,cleanup};
}
