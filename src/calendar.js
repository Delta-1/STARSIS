export function dateKey(value,zone='America/Sao_Paulo'){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}`;
}
export function localToISO(value,zone='America/Sao_Paulo'){
 const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)throw Error('Informe uma data válida.');
 const wanted=Date.UTC(...[Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5])]);let timestamp=wanted;
 for(let i=0;i<3;i++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));const rendered=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));timestamp+=wanted-rendered;}
 return new Date(timestamp).toISOString();
}
