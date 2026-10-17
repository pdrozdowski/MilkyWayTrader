import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayerEligibility } from '../../src/game/application/auth/playerEligibility.ts';

function deferred ()
{
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function authFixture (initial)
{
    let snapshot = initial;
    const listeners = new Set();
    return {
        port: { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } },
        set: value => { snapshot = value; for (const listener of listeners) listener(value); }
    };
}

const signedIn = ownerId => ({ status: 'signed-in', ownerId, anonymous: false, email: null, message: null });
const anonymous = ownerId => ({ status: 'signed-in', ownerId, anonymous: true, email: null, message: null });
const unsigned = { status: 'unsigned', ownerId: null, anonymous: false, email: null, message: null };

test('eligibility rejects anonymous owners and clears readiness at sign-out', async () => {
    const auth = authFixture(anonymous('anon-1'));
    let profileLoads = 0;
    const eligibility = createPlayerEligibility(auth.port, { loadOrCreate: async () => { profileLoads++; return { nickname: 'pilot' }; } }, () => 'pilot');
    assert.equal(eligibility.getSnapshot().status, 'unsigned');
    auth.set(signedIn('owner-1'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(eligibility.getSnapshot().status, 'ready');
    auth.set(unsigned);
    assert.equal(eligibility.getSnapshot().status, 'unsigned');
    assert.equal(profileLoads, 1);
    eligibility.destroy();
});

test('eligibility binds profile creation to the signed-in owner', async () => {
    const auth = authFixture(signedIn('owner-1'));
    let expectedOwner;
    const eligibility = createPlayerEligibility(auth.port, { loadOrCreate: async (_nickname, ownerId) => { expectedOwner = ownerId; return { nickname: 'pilot' }; } }, () => 'pilot');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(expectedOwner, 'owner-1');
    eligibility.destroy();
});

test('eligibility discards a late profile response after account switch', async () => {
    const auth = authFixture(signedIn('owner-a'));
    const first = deferred();
    const second = deferred();
    const eligibility = createPlayerEligibility(auth.port, { loadOrCreate: () => auth.port.getSnapshot().ownerId === 'owner-a' ? first.promise : second.promise }, () => 'pilot');
    auth.set(signedIn('owner-b'));
    second.resolve({ nickname: 'ownerB' });
    await new Promise(resolve => setImmediate(resolve));
    first.resolve({ nickname: 'ownerA' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(eligibility.getSnapshot().ownerId, 'owner-b');
    assert.equal(eligibility.getSnapshot().profile.nickname, 'ownerB');
    eligibility.destroy();
});

