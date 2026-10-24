import test from 'node:test';
import assert from 'node:assert/strict';
import {replyDelay,stillUnanswered,needsPersonalApproval} from '../personal-domain.js';
import {phoneFromJid,resolveIdentity,canAutoReplyToGroup} from '../chat-identity.js';
import {dateKey,localToISO} from '../../src/calendar.js';
test('opaque LIDs never become phone numbers; alternate IDs and persisted mappings resolve real phones',async()=>{
 assert.equal(phoneFromJid('123456789012345@lid'),'');assert.equal(phoneFromJid('5511999999999:5@s.whatsapp.net'),'5511999999999');
 const key={remoteJid:'123456789012345@lid',remoteJidAlt:'5511999999999@s.whatsapp.net'};
 assert.equal((await resolveIdentity(key)).phone,'5511999999999');
 assert.equal((await resolveIdentity({remoteJid:key.remoteJid},null,async()=>key.remoteJidAlt)).phone,'5511999999999');
 assert.equal((await resolveIdentity({remoteJid:'123@g.us'})).isGroup,true);
});
test('group bots respond only when enabled and mentioned or directly replied to',()=>{
 const c={isGroup:true,paused:false},own=['5511999999999:1@s.whatsapp.net'];
 assert.equal(canAutoReplyToGroup(c,{},own),false);assert.equal(canAutoReplyToGroup(c,{mentions:['5511999999999@s.whatsapp.net']},own),true);
 assert.equal(canAutoReplyToGroup({...c,paused:true},{mentions:own},own),false);assert.equal(canAutoReplyToGroup(c,{quotedParticipant:own[0]},own),true);
});
test('personal jobs cancel after owner response, newer incoming messages, opt-out or pause',()=>{
 const incoming={id:'incoming-1',at:'2026-10-24T12:00:00Z'},contact={lastDirection:'in',lastInboundAt:incoming.at,lastInboundId:incoming.id};
 assert.equal(stillUnanswered(contact,{incoming}),true);
 for(const extra of [{paused:true},{optOut:true},{lastDirection:'out'},{lastManualReplyAt:'2026-10-24T12:00:01Z'},{lastInboundAt:'2026-10-24T12:01:00Z'},{lastInboundId:'incoming-2'}])assert.equal(stillUnanswered({...contact,...extra},{incoming}),false);
 assert.equal(replyDelay({},{}),120);assert.equal(replyDelay({delaySeconds:2},{}),60);assert.equal(replyDelay({delaySeconds:99999},{}),3600);
 assert.equal(needsPersonalApproval({settings:{usageMode:'personal'}},{approvalMode:'always'},{}),true);
 assert.equal(needsPersonalApproval({settings:{usageMode:'personal'}},{},{needsApproval:true}),true);
 assert.equal(needsPersonalApproval({settings:{usageMode:'company'}},{approvalMode:'always'},{}),false);
});
test('calendar dates respect Brasília and Acre rather than server timezone',()=>{
 assert.equal(localToISO('2026-10-24T09:30','America/Sao_Paulo'),'2026-10-24T12:30:00.000Z');
 assert.equal(localToISO('2026-10-24T09:30','America/Rio_Branco'),'2026-10-24T14:30:00.000Z');
 assert.equal(dateKey('2026-10-25T02:00:00Z','America/Sao_Paulo'),'2026-10-24');
});
