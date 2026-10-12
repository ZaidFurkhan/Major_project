import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STALE_AFTER_MS, isStale, ageMs } from '../../src/realtime/staleness.js';

describe('staleness rules', () => {
  it('identifies 1-second old timestamp as not stale and 10-second old as stale with default window', () => {
    const now = 1770000000000;
    const oneSecAgo = new Date(now - 1000).toISOString();
    const tenSecsAgo = new Date(now - 10000).toISOString();

    assert.equal(isStale(oneSecAgo, now), false);
    assert.equal(ageMs(oneSecAgo, now), 1000);

    assert.equal(isStale(tenSecsAgo, now), true);
    assert.equal(ageMs(tenSecsAgo, now), 10000);
    assert.equal(STALE_AFTER_MS, 5000);
  });

  it('treats invalid timestamp as stale and ageMs returns null', () => {
    assert.equal(isStale('not-a-valid-date'), true);
    assert.equal(ageMs('not-a-valid-date'), null);

    assert.equal(isStale(null), true);
    assert.equal(ageMs(null), null);

    assert.equal(isStale(undefined), true);
    assert.equal(ageMs(undefined), null);
  });

  it('respects a custom staleAfterMs threshold', () => {
    const now = 1770000000000;
    const threeSecsAgo = new Date(now - 3000).toISOString();

    // Default window is 5000ms: 3s is not stale
    assert.equal(isStale(threeSecsAgo, now), false);

    // Custom window of 2000ms: 3s is stale
    assert.equal(isStale(threeSecsAgo, now, 2000), true);

    // Custom window of 10000ms: 3s is not stale
    assert.equal(isStale(threeSecsAgo, now, 10000), false);
  });
});
