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
