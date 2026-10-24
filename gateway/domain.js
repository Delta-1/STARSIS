import {createHash,createCipheriv,createDecipheriv,randomBytes,timingSafeEqual} from 'node:crypto';
export const stages=['novo','qualificacao','reuniao','proposta','ganho','perdido'];
export const idFor=(...v)=>createHash('sha256').update(v.join(':')).digest('hex');
export function authorized(actual,expected){const a=Buffer.from(actual||''),b=Buffer.from(expected||'');return b.length>=32&&a.length===b.length&&timingSafeEqual(a,b);}
export function vault(secret){const key=createHash('sha256').update(secret).digest();return {
 seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(JSON.stringify(value)),c.final(),c.getAuthTag()]).toString('base64');},
 open(value){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString());}
};}
export function cleanAgent(a){const {apiKey,encryptedKey,...safe}=a;return {...safe,hasKey:Boolean(encryptedKey)};}
export function selectAgent(agents,contact){if(contact.paused||['ganho','perdido'].includes(contact.stage))return null;return agents.find(a=>a.enabled&&a.id===contact.agentId)||agents.find(a=>a.enabled&&a.stages?.includes(contact.stage))||agents.find(a=>a.enabled&&a.stages?.includes('todos'))||null;}
export function validateSlot(value){const n=Date.parse(value);if(!Number.isFinite(n)||n<Date.now()+60000)throw Error('Escolha uma data futura para a reunião.');return new Date(n).toISOString();}
export function validAgent(input,previous={}){const a={...previous};for(const k of ['name','role','personality','rules','knowledge','provider','model','voice','voiceMode','handoff'])if(typeof input[k]==='string')a[k]=input[k].slice(0,k==='knowledge'?40000:8000);a.name=String(a.name||'').trim();if(!a.name)throw Error('Dê um nome ao agente.');if(!['gemini','anthropic','openai'].includes(a.provider))throw Error('Provedor inválido.');a.stages=(Array.isArray(input.stages)?input.stages:previous.stages||['todos']).filter(s=>s==='todos'||stages.includes(s));a.enabled=Boolean(input.enabled);a.notes=input.notes!==false;a.schedule=Boolean(input.schedule);a.voiceMode=['text','mirror','audio'].includes(a.voiceMode)?a.voiceMode:'text';return a;}

// Every automatic dispatch, including follow-up, obeys the company pause.
export function canDispatch(company,contact){return Boolean(company?.settings?.autoReply)&&!contact.paused&&!contact.optOut&&!['ganho','perdido'].includes(contact.stage);}
