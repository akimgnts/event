import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventKpis,ratio} from '../lib/kpis';
import {answerQuestion} from '../lib/analyst';
test('ratios preserve unknown values and reject zero denominators',()=>{assert.equal(ratio(null,16),null);assert.equal(ratio(17,0),null);assert.equal(ratio(0,16),0);assert.equal(ratio(17,16),1.0625)});
test('no matching currency or campaign link means no marketing attribution',()=>{const e={currency:'EUR',paid_tickets:16,face_value:54,scanned:13,valid_tickets:16,orders:13};assert.equal(eventKpis(e).spend,null);assert.equal(eventKpis(e,{currency:'USD',spend:17}).partialBalance,null);const k=eventKpis(e,{currency:'EUR',spend:17});assert.equal(k.adPerTicket,1.0625);assert.equal(k.partialBalance,37);assert.equal(k.averagePrice,3.375)});
test('assistant never presents the per-ticket ratio as an attributed CAC',()=>{const result=answerQuestion('Quel est mon coût acquisition CAC ?',null,{events:[],successful:[]});assert.match(result.answer,/inconnu/);assert.match(result.answer,/ne prouve pas/)});
test('content analysis respects event links',()=>{const d={events:[{event_id:'one'},{event_id:'two'}],successful:[],contentLinks:[{media_id:'m',event_id:'one'}],instagram:[{media_id:'m',published_at:'2026-10-25',views:100}]};assert.match(answerQuestion('Statistiques reel','two',d).answer,/Aucun contenu/);assert.match(answerQuestion('Statistiques reel','one',d).answer,/100 vues/)});
