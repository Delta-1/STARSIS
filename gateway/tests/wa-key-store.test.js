import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersistentKeys} from '../wa-key-store.js';
import {vault,idFor} from '../domain.js';
test('one transaction batches hundreds of encrypted Signal keys and reads them in one tenant-scoped query',async()=>{
 const records=new Map(),calls=[],crypt=vault('only-local-key-test-secret');let broken=false;
 const db={from(table){let mode='get',value,filters={},ids=[];return {select(){return this;},eq(k,v){filters[k]=v;return this;},in(k,v){ids=v;return this;},upsert(v){mode='put';value=v;return this;},delete(){mode='delete';return this;},then(resolve){calls.push({table,mode,filters,ids});if(broken)return Promise.resolve({error:{message:'offline'}}).then(resolve);if(mode==='put')value.forEach(row=>records.set(row.id,row));if(mode==='delete')ids.forEach(id=>{const row=records.get(id);if(row?.company_id===filters.company_id&&row?.kind===filters.kind)records.delete(id);});return Promise.resolve({data:ids.map(id=>records.get(id)).filter(row=>row&&row.company_id===filters.company_id&&row.kind===filters.kind),error:null}).then(resolve);}};}};
 const store=cid=>createPersistentKeys({db,cid,nid:'phone',crypt,slot:key=>idFor(cid,'phone',key),reviver:undefined,replacer:undefined,fromAppState:value=>({...value,decoded:true}),fail:(status,message)=>Object.assign(Error(message),{status})});
 const keys=store('company-a'),values=Object.fromEntries(Array.from({length:200},(_,i)=>[String(i),{key:'private-value-'+i}]));
 await keys.set({'pre-key':values});assert.equal(calls.length,1);assert.equal(records.size,200);assert.equal(JSON.stringify([...records.values()]).includes('private-value'),false);
 const read=await keys.get('pre-key',['0','199','missing']);assert.deepEqual(read['0'],values['0']);assert.deepEqual(read['199'],values['199']);assert.equal(read.missing,null);assert.equal(calls.length,2);
 assert.deepEqual(await store('company-b').get('pre-key',['0']),{'0':null});
 await keys.set({'pre-key':{'0':null},'app-state-sync-key':{'state':{key:'state'}}});assert.equal((await keys.get('pre-key',['0']))['0'],null);assert.equal((await keys.get('app-state-sync-key',['state'])).state.decoded,true);
 broken=true;await assert.rejects(keys.set({'session':{'device':{key:'value'}}}),{status:503});await assert.rejects(keys.get('session',['device']),{status:503});
});
