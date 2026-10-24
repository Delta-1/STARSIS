import {randomUUID} from 'node:crypto';
export function memoryDatabase(){
 const tables={startsys_records:[],startsys_accounts:[],startsys_sessions:[],startsys_companies:[]};
 const field=(r,k)=>k.includes('->>')?k.split('->>').reduce((a,v)=>a?.[v],r):r[k];
 const db={tables,from(table){let operation='select',value,filters=[],single=false,limit=Infinity,offset=0,orders=[],projection='';
  const q={select(p='*'){projection=p;return q;},insert(v){operation='insert';value=v;return q;},upsert(v){operation='upsert';value=v;return q;},update(v){operation='update';value=v;return q;},delete(){operation='delete';return q;},eq(k,v){filters.push(r=>field(r,k)===v);return q;},neq(k,v){filters.push(r=>field(r,k)!==v);return q;},in(k,v){filters.push(r=>v.includes(field(r,k)));return q;},lte(k,v){filters.push(r=>field(r,k)<=v);return q;},gte(k,v){filters.push(r=>field(r,k)>=v);return q;},lt(k,v){filters.push(r=>field(r,k)<v);return q;},order(k,options={}){orders.push([k,options.ascending!==false]);return q;},limit(n){limit=n;return q;},range(a,b){offset=a;limit=b-a+1;return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},then(resolve,reject){try{
   const all=tables[table]??=[],match=r=>filters.every(f=>f(r));let data=[],error=null;
   if(['insert','upsert'].includes(operation)){const id=value.id||randomUUID(),found=all.find(r=>r.id===id||table==='startsys_accounts'&&r.email===value.email||table==='startsys_sessions'&&r.token_hash===value.token_hash);if(found&&operation==='insert')error={code:'23505'};else if(found){Object.assign(found,structuredClone(value));data=[found];}else{const record={id,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...structuredClone(value)};all.push(record);data=[record];}}
   else if(operation==='delete'){tables[table]=all.filter(r=>!match(r));}
   else{data=all.filter(match);if(operation==='update')data.forEach(r=>Object.assign(r,structuredClone(value)));}
   for(const [key,ascending]of orders.reverse())data.sort((a,b)=>String(field(a,key)||'').localeCompare(String(field(b,key)||''))*(ascending?1:-1));const count=data.length;data=data.slice(offset,offset+limit);
   data=structuredClone(data).map(r=>table==='startsys_sessions'&&projection.includes('startsys_accounts')?{...r,startsys_accounts:structuredClone(tables.startsys_accounts.find(a=>a.id===r.account_id))}:r);
   return Promise.resolve({data:single?data[0]||null:data,error,count}).then(resolve,reject);
  }catch(e){return Promise.reject(e).then(resolve,reject);}}};return q;
 }};return db;
}
export function routeHarness(){const layers=[];const app={get:(p,...h)=>layers.push({method:'GET',path:p,handlers:h}),post:(p,...h)=>layers.push({method:'POST',path:p,handlers:h}),patch:(p,...h)=>layers.push({method:'PATCH',path:p,handlers:h}),delete:(p,...h)=>layers.push({method:'DELETE',path:p,handlers:h}),use:(...h)=>layers.push({handlers:h})};
 async function request(path,method='GET',body={},token='',ip='local-test'){
  const req={path,method,body,ip,params:{},query:{},get:n=>n.toLowerCase()==='authorization'?`Bearer ${token}`:undefined},res={statusCode:200,body:undefined,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
  for(const layer of layers){if(layer.path){if(layer.method!==method)continue;const names=[];const pattern=layer.path.replace(/:([^/]+)/g,(_,name)=>{names.push(name);return '([^/]+)';}),match=path.match(new RegExp('^'+pattern+'$'));if(!match)continue;req.params=Object.fromEntries(names.map((n,i)=>[n,match[i+1]]));}
   for(const fn of layer.handlers){let proceed=false;try{await fn(req,res,()=>{proceed=true;});}catch(e){res.statusCode=e.status||500;res.body={error:e.message};return res;}if(!proceed)return res;}
  }return res;
 }return {app,request};
}
export function recordStore(db){const fail=(status,message)=>Object.assign(Error(message),{status}),queues=new Map();const get=async(cid,id,kind)=>{const row=db.tables.startsys_records.find(r=>r.company_id===cid&&r.id===id&&r.kind===kind);if(!row)throw fail(404,'Registro não encontrado');return {...structuredClone(row.data),id:row.id,createdAt:row.created_at,updatedAt:row.updated_at};};const put=async(cid,kind,value,id=randomUUID())=>{const {id:_,createdAt,updatedAt,...data}=value;await db.from('startsys_records').upsert({id,company_id:cid,kind,data,updated_at:new Date().toISOString()});return {...structuredClone(data),id};};const rows=async(cid,kind,limit=500)=>db.tables.startsys_records.filter(r=>r.company_id===cid&&r.kind===kind).slice(-limit).reverse().map(r=>({...structuredClone(r.data),id:r.id,createdAt:r.created_at,updatedAt:r.updated_at}));const serial=(key,fn)=>{const p=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,p);return p;};return {db,get,put,rows,fail,serial,companyById:async id=>{const c=db.tables.startsys_companies.find(c=>c.id===id);if(!c)throw fail(404,'Empresa não encontrada');return structuredClone(c);},audit:async()=>{}};}
