import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {installAuth} from '../auth.js';
// In-memory Data API substitute. No production credentials, HTTP calls or stored fixtures.
function database(){
 const tables={startsys_accounts:[],startsys_sessions:[]};
 return {tables,from(table){let operation='select',value,filters=[],single=false;
  const q={select(){return q;},insert(v){operation='insert';value=v;return q;},update(v){operation='update';value=v;return q;},delete(){operation='delete';return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},neq(k,v){filters.push(r=>r[k]!==v);return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},then(resolve,reject){
   try{let data=table in tables?tables[table]:[],error=null;const match=r=>filters.every(f=>f(r));
    if(operation==='insert'){if(table==='startsys_accounts'&&data.some(r=>r.email===value.email))error={code:'23505'};else{value={id:randomUUID(),...value};data.push(value);data=[value];}}
    else if(operation==='delete'){tables[table]=data.filter(r=>!match(r));data=[];}
    else{data=data.filter(match);if(operation==='update')data.forEach(r=>Object.assign(r,value));}
    data=data.map(r=>table==='startsys_sessions'?{...r,startsys_accounts:tables.startsys_accounts.find(a=>a.id===r.account_id)}:{...r});
    return Promise.resolve({data:single?data[0]||null:data,error}).then(resolve,reject);
   }catch(e){return Promise.reject(e).then(resolve,reject);}
  }};return q;
 }};
}
function appHarness(){
 const layers=[];const app={post(path,...handlers){layers.push({method:'POST',path,handlers});},get(path,...handlers){layers.push({method:'GET',path,handlers});},use(...handlers){layers.push({handlers});}};
 async function request(path,method='GET',body={},token='',ip='test-ip'){
  const req={path,method,body,ip,get:name=>name.toLowerCase()==='authorization'?`Bearer ${token}`:undefined};
  const response={statusCode:200,body:undefined,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
  const handlers=layers.filter(l=>!l.path||(l.path===path&&l.method===method)).flatMap(l=>l.handlers);
  for(const fn of handlers){let next=false;try{await fn(req,response,()=>{next=true;});}catch(e){response.statusCode=e.status||500;response.body={error:e.message};break;}if(!next)break;}
  return response;
 }
 return {app,request};
}
test('independent auth registers, verifies, revokes and expires sessions using only a memory database',async()=>{
 const db=database(),{app,request}=appHarness();installAuth(app,db);
 const registered=await request('/auth/register','POST',{name:'Teste local',email:'unit@example.invalid',password:'only-local-test-password'});
 assert.equal(registered.statusCode,200);assert.ok(registered.body.token);assert.equal(db.tables.startsys_accounts.length,1);
 assert.notEqual(db.tables.startsys_accounts[0].password_hash,'only-local-test-password');
 assert.notEqual(db.tables.startsys_sessions[0].token_hash,registered.body.token);
 assert.equal((await request('/auth/login','POST',{email:'unit@example.invalid',password:'invalid-password'})).statusCode,401);
 const login=await request('/auth/login','POST',{email:'UNIT@example.invalid',password:'only-local-test-password'});assert.ok(login.body.token);
 assert.equal((await request('/auth/me','GET',{},login.body.token)).body.name,'Teste local');
 assert.equal((await request('/auth/me','GET',{},'forged-token')).statusCode,401);
 await request('/auth/logout','POST',{},login.body.token);
 assert.equal((await request('/auth/me','GET',{},login.body.token)).statusCode,401);
 db.tables.startsys_sessions[0].expires_at='2000-01-01T00:00:00Z';
 assert.equal((await request('/auth/me','GET',{},registered.body.token)).statusCode,401);
});
test('repeated failed login attempts are throttled without touching an external account',async()=>{
 const {app,request}=appHarness();installAuth(app,database());let last;
 for(let i=0;i<21;i++)last=await request('/auth/login','POST',{email:'missing@example.invalid',password:'invalid-password'},'', 'isolated-rate-test');
 assert.equal(last.statusCode,429);
});
