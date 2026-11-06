import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages} from '../src/messages.js';
test('polling preserves older loaded history, updates edits and avoids duplicate messages',()=>{
 const initial=[{id:'2',text:'old text'},{id:'3',text:'latest'}];
 const loaded=mergeMessages(initial,[{id:'1',text:'history'},{id:'2',text:'old text'}],true);
 assert.deepEqual(loaded.map(m=>m.id),['1','2','3']);
 const polled=mergeMessages(loaded,[{id:'2',text:'edited'},{id:'3',text:'latest'},{id:'4',text:'new'}]);
 assert.deepEqual(polled.map(m=>m.id),['1','2','3','4']);assert.equal(polled[1].text,'edited');
});
test('push and HTTP confirmations replace pending bubbles without duplicates or status regressions',()=>{
 const pending={id:'pending-1',clientRequestId:'1',text:'Olá',delivery:'pending'};
 const confirmed={id:'server-1',clientRequestId:'1',text:'Olá',delivery:'sent'};
 let messages=mergeMessages([pending],[confirmed]);assert.equal(messages.length,1);assert.equal(messages[0].id,'server-1');
 messages=mergeMessages(messages,[{...pending,delivery:'uncertain'}]);assert.equal(messages[0].delivery,'sent');
 messages=mergeMessages(messages,[{...confirmed,text:'Texto editado',delivery:'read'}]);assert.equal(messages[0].text,'Texto editado');assert.equal(messages[0].delivery,'read');
});
