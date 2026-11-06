import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceContacts} from '../src/conversations.js';
test('attendants can find a synchronized group before its first message without filling the main queue with empty groups',()=>{
 const contacts=[{id:'empty-group',name:'Equipe de suporte',isGroup:true},{id:'group',name:'Clientes',isGroup:true,lastAt:'2026-11-05'},{id:'person',name:'Ana',lastAt:'2026-11-05'},{id:'merged',name:'Antigo',isGroup:true,redirectTo:'group'}];
 assert.deepEqual(attendanceContacts(contacts,'','groups').map(c=>c.id),['empty-group','group']);
 assert.deepEqual(attendanceContacts(contacts,'','direct').map(c=>c.id),['person']);
 assert.deepEqual(attendanceContacts(contacts).map(c=>c.id),['group','person']);
 assert.deepEqual(attendanceContacts(contacts,'SUPORTE','groups').map(c=>c.id),['empty-group']);
});
