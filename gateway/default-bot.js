import {idFor,cleanAgent} from './domain.js';
export function defaultBot(company){return {id:idFor(company.id,'default-bot'),preset:true,name:'Sofia',role:'Recepção e triagem',provider:'builtin',model:'roteiro-v1',enabled:false,stages:['todos'],notes:true,schedule:false,voiceMode:'text'};}
export function defaultBotReply(company,history,contact){
 const incoming=history.filter(m=>m.direction==='in').at(-1)||{},raw=String(incoming.text||'').trim(),text=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const base={note:'',stage:null,meetingAt:null,stop:false,needsApproval:false,nextStep:contact.defaultBotStep||'menu',handoff:false};
 const result=(reply,extra={})=>({...base,reply,...extra});
 const handoff=()=>result('Certo! Seu atendimento ficou na fila da equipe. Um atendente continuará por aqui assim que estiver disponível.',{handoff:true,nextStep:'handoff',note:raw.slice(0,1000)});
 if(/\b(pare|parar|sair|stop)\b|nao me envie/.test(text))return result('',{stop:true});
 if(incoming.type&&incoming.type!=='text'||text==='3'||/\b(humano|atendente|pessoa|reclamacao|cancelamento)\b/.test(text))return handoff();
 if(contact.defaultBotStep&&contact.defaultBotStep!=='menu')return handoff();
 if(/\b(horario|funcionamento|abre|fecha)\b/.test(text)&&company.settings?.hours)return result(`Nosso horário informado é: ${company.settings.hours}. Como podemos ajudar?\n1 · Informações\n2 · Orçamento\n3 · Falar com um atendente`);
 if(text==='2'||/\b(orcamento|preco|valor|comprar|contratar)\b/.test(text))return result('Para preparar seu orçamento, qual produto ou serviço você procura? Conte também a quantidade ou o que precisa.',{nextStep:'budget',stage:'qualificacao'});
 if(text==='1'||/\b(informacoes|servicos|produtos)\b/.test(text))return result(`${company.settings?.description?String(company.settings.description).slice(0,500)+'\n\n':''}Sobre qual produto ou serviço você quer saber mais?`,{nextStep:'details'});
 if(/\b(problema|pedido|ajuda|suporte|defeito)\b/.test(text))return result('Me conte o que aconteceu e, se tiver, o número do pedido. Vou deixar tudo organizado para a equipe continuar.',{nextStep:'support'});
 if(raw.length>55)return handoff();
 return result(`Olá! Sou a Sofia, assistente virtual de ${company.name}. Como posso ajudar?\n1 · Informações\n2 · Orçamento\n3 · Falar com um atendente`,{nextStep:'menu'});
}

export function installDefaultBot(app,{db,get,put,fail,audit}){
app.post('/bot/default',async(req,res)=>{
 const co=req.company,preset=defaultBot(co);let previous=preset;
 try{previous=await get(co.id,preset.id,'agent');}catch(error){if(error.status!==404)throw error;}
 const enabled=req.body.enabled===true,settings={...co.settings};
 if(enabled){settings.autoReply=true;if(settings.workMode==='team')settings.workMode='hybrid';}
 const {error}=await db.from('startsys_companies').update({settings}).eq('id',co.id).eq('owner_id',req.owner);
 if(error)throw fail(503,'Não foi possível ativar o bot.');
 const agent=await put(co.id,'agent',{...previous,...preset,enabled},preset.id);
 await audit(co.id,enabled?'Bot padrão Sofia ativado.':'Bot padrão Sofia pausado.','agent',preset.id);
 res.json({agent:cleanAgent(agent),autoReply:settings.autoReply});
});
}
