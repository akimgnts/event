import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeTicket,validateTicket} from '../lib/connectors/shotgun';
import {validKey} from '../lib/auth';
test('unconfigured or absent keys never authorize',()=>{const before=process.env.EVENT_SIGNAL_INTERNAL_API_KEY;delete process.env.EVENT_SIGNAL_INTERNAL_API_KEY;assert.equal(validKey(null),false);assert.equal(validKey(''),false);process.env.EVENT_SIGNAL_INTERNAL_API_KEY='test-secret';assert.equal(validKey(null),false);assert.equal(validKey('wrong'),false);assert.equal(validKey('test-secret'),true);if(before)process.env.EVENT_SIGNAL_INTERNAL_API_KEY=before;else delete process.env.EVENT_SIGNAL_INTERNAL_API_KEY;});
test('contact fields and scan credentials cannot cross allowlist',()=>{const result=safeTicket({contact_email:'blocked',ticket_scan_code:'blocked',user_id:42,unknown_secret:'blocked'});assert.deepEqual(result,{});});
test('missing schema fails rather than fabricating zero tickets',()=>{assert.throws(()=>validateTicket({}));});
