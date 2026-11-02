import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tokenStatus} from '../lib/token-health';
const now=Date.UTC(2026,10,2),sec=now/1000;
test('expired or revoked access requires reconnection',()=>{assert.equal(tokenStatus({is_valid:false},now),'reconnect_required');assert.equal(tokenStatus({is_valid:true,expires_at:sec-1},now),'reconnect_required')});
test('data access deadline can precede token expiration',()=>{assert.equal(tokenStatus({is_valid:true,expires_at:sec+60*86400,data_access_expires_at:sec+2*86400},now),'expires_soon')});
test('zero expiry is not treated as already expired',()=>{assert.equal(tokenStatus({is_valid:true,expires_at:0},now),'valid_no_fixed_expiry');assert.equal(tokenStatus({is_valid:true,expires_at:sec+60*86400},now),'valid')});
