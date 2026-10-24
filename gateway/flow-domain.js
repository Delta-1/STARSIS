export const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matches(mode,keywords,text){if(mode==='any')return true;const value=normalize(text);return String(keywords||'').split('\n').map(normalize).filter(Boolean).some(word=>mode==='exact'?value===word:value.includes(word));}
export const renderText=(text,name)=>String(text||'').replaceAll('{{nome}}',()=>String(name||'contato'));
export const handles=node=>node.type==='end'||node.type==='handoff'?[]:node.type==='condition'?['yes','no']:node.type==='reply'?['reply','timeout']:['out'];
export const nextNode=(flow,id,handle='out')=>flow.edges.find(e=>e.from===id&&e.handle===handle)?.to||null;
export function validateFlow(flow){
 if(!flow||!Array.isArray(flow.nodes)||!Array.isArray(flow.edges)||flow.nodes.length<2||flow.nodes.length>60||flow.edges.length>100)return 'Use entre 2 e 60 blocos.';
 const nodes=new Map(flow.nodes.map(n=>[n.id,n]));if(nodes.size!==flow.nodes.length||flow.nodes.some(n=>typeof n.id!=='string'||!/^[\w-]{1,100}$/.test(n.id)||!['start','text','audio','condition','delay','reply','ai','handoff','end'].includes(n.type)))return 'Blocos inválidos ou repetidos.';
 const starts=flow.nodes.filter(n=>n.type==='start');if(starts.length!==1)return 'Use exatamente um início.';
 for(const n of flow.nodes){const d=n.data||{};
  if(n.type==='text'&&(typeof d.text!=='string'||!d.text.trim()||d.text.length>6000))return 'Preencha o texto dos blocos (até 6 mil caracteres).';
  if(n.type==='audio'&&(typeof d.clipId!=='string'||!d.clipId))return 'Escolha um áudio salvo para cada bloco de áudio.';
  if(n.type==='ai'&&(typeof d.agentId!=='string'||!d.agentId||typeof d.instruction!=='string'||!d.instruction.trim()||d.instruction.length>4000))return 'Escolha o agente e a instrução do bloco de IA.';
  if(['reply','delay'].includes(n.type)&&(!Number.isFinite(d.minutes)||d.minutes<0.1||d.minutes>10080))return 'A espera deve ser de 6 segundos a 7 dias.';
  if(n.type==='condition'&&(!['contains','exact'].includes(d.mode)||typeof d.keywords!=='string'||!d.keywords.trim()||d.keywords.length>1000))return 'Preencha as palavras da condição.';
  const out=flow.edges.filter(e=>e.from===n.id),expected=handles(n);if(out.length!==expected.length||expected.some(h=>out.filter(e=>e.handle===h).length!==1))return 'Conecte todas as saídas dos blocos.';
 }
 if(flow.edges.some(e=>!nodes.has(e.from)||!nodes.has(e.to)||e.to===starts[0].id))return 'Conexão inválida.';
 const visiting=new Set(),seen=new Set();function visit(id){if(visiting.has(id))throw Error();if(seen.has(id))return;visiting.add(id);for(const e of flow.edges.filter(e=>e.from===id))visit(e.to);visiting.delete(id);seen.add(id);}
 try{visit(starts[0].id);}catch{return 'Não conecte o fluxo de volta a uma etapa anterior.';}
 if(seen.size!==nodes.size)return 'Conecte ou remova os blocos soltos.';return null;
}
export function canContinue(company,contact,run){
 return company?.settings?.usageMode!=='personal'&&!contact.redirectTo&&!contact.isGroup&&!contact.optOut&&contact.attendanceStatus!=='closed'&&contact.activeFlowId===run.id&&(!contact.lastManualReplyAt||contact.lastManualReplyAt<=run.startedAt)&&(run.manual||Boolean(company?.settings?.autoReply)&&!contact.paused&&!contact.assignedTo);
}
export function simulateFlow(flow,text,clips=[]){
 const error=validateFlow(flow);if(error)throw Error(error);let id=flow.nodes.find(n=>n.type==='start').id;const steps=[];
 for(let i=0;id&&i<60;i++){const n=flow.nodes.find(n=>n.id===id);let handle='out';if(n.type==='text')steps.push(renderText(n.data.text,'Contato de teste'));else if(n.type==='audio')steps.push('Áudio: '+(clips.find(c=>c.id===n.data.clipId)?.name||'áudio salvo'));else if(n.type==='condition'){handle=matches(n.data.mode,n.data.keywords,text)?'yes':'no';steps.push('Condição: '+(handle==='yes'?'sim':'não'));}else if(n.type==='reply'){steps.push('Aguardar resposta (simulação: respondeu)');handle='reply';}else if(n.type==='delay')steps.push(`Aguardar ${n.data.minutes} min`);else if(n.type==='ai')steps.push('Consultar IA: '+n.data.instruction);else if(n.type==='handoff')steps.push('Encaminhar para a equipe');else if(n.type==='end')steps.push('Fim');id=nextNode(flow,id,handle);}
 return steps;
}
