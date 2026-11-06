import {useRef,useEffect,Dispatch,SetStateAction} from 'react';
import {json} from './api';
import {mergeMessages} from './messages.js';
type Row=Record<string,any>;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export function useMessageOutbox(selected:{current:string|null},setMessages:Dispatch<SetStateAction<Row[]>>,notify:(text:string)=>void){
 const entries=useRef(new Map<string,Row>()),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;entries.current.clear();};},[]);
 function update(message:Row){
  if(!active.current)return;
  if(['pending','failed','uncertain'].includes(message.delivery))entries.current.set(message.clientRequestId,message);else entries.current.delete(message.clientRequestId);
  if(selected.current===message.contactId)setMessages(previous=>mergeMessages(previous,[message]));
 }
 function cached(contactId:string){return [...entries.current.values()].filter(m=>m.contactId===contactId);}
 async function submit(body:Row,metadata:Row){
  const pending:Row={...metadata,id:'pending-'+body.requestId,clientRequestId:body.requestId,contactId:body.contactId,direction:'out',type:body.type||'text',text:body.text||body.filename||(body.type==='sticker'?'Figurinha':body.type==='audio'?'Mensagem de voz':'Anexo'),at:new Date().toISOString(),delivery:'pending'};
  update(pending);
  try{
   let result=await json('send','POST',body);
   const until=Date.now()+120000;
   while(result.status==='sending'&&active.current&&Date.now()<until){await pause(2000);if(!active.current)return;result=await json(`send/${body.requestId}`);}
   const confirmed=result.message||(!result.status&&result.id?result:null);
   if(confirmed){update(confirmed);return;}
   const failed=result.status==='failed';update({...pending,delivery:failed?'failed':'uncertain',sendError:result.error});
   if(active.current)notify(result.error||(failed?'A mensagem não foi enviada.':'Confirmação pendente. Confira a conversa antes de reenviar.'));
  }catch(error:any){
   update({...pending,delivery:error.status&&error.status<500?'failed':'uncertain',sendError:error.message});
   if(active.current)notify(error.status&&error.status<500?error.message:'Confirmação pendente. Confira a conversa antes de reenviar.');
  }
 }
 return {submit,cached};
}
