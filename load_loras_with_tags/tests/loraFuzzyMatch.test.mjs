import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  filterFuzzyIndices,
  matchFuzzyPositions,
  rankFuzzy,
  rankFuzzyIndices,
  scoreFuzzy,
} from '../../web/loadLorasWithTags/js/loraFuzzyMatch.js';

describe('loraFuzzyMatch', () => {
  it('scores matches', () => {
    assert.equal(scoreFuzzy('abc', 'def'), Number.NEGATIVE_INFINITY);
    assert.ok(scoreFuzzy('abc', 'a_x_b_x_c') > Number.NEGATIVE_INFINITY);
    assert.equal(scoreFuzzy('abc', 'AbC'), Number.POSITIVE_INFINITY);
    assert.equal(scoreFuzzy('', 'abc'), 0);

    assert.ok(scoreFuzzy('fb', 'fooBar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'foo_bar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'foo-bar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'foo bar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'foo.bar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'foo/bar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'foo\\bar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('gen wan', 'WAN/General') > Number.NEGATIVE_INFINITY);
    assert.ok(scoreFuzzy('gen wan', 'WAN General') > Number.NEGATIVE_INFINITY);
    assert.ok(scoreFuzzy('wan gen', 'WAN/General') > Number.NEGATIVE_INFINITY);
    assert.equal(scoreFuzzy('gen wan', 'WAN/Other'), Number.NEGATIVE_INFINITY);

    assert.equal(scoreFuzzy('a', ''), Number.NEGATIVE_INFINITY);
    assert.equal(scoreFuzzy('abc', 'ab'), Number.NEGATIVE_INFINITY);
    assert.equal(scoreFuzzy('a', 'a'), Number.POSITIVE_INFINITY);
    assert.equal(scoreFuzzy('a', 'A'), Number.POSITIVE_INFINITY);
    assert.ok(scoreFuzzy('a', 'a123') > scoreFuzzy('a', 'ba123'));
    assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'a_b_c'));
    assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'a__bc'));
    assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'ab__c'));
  });

  it('ranks matches', () => {
    const ranked = rankFuzzy('abc', ['axbyc', 'abc', 'zzz', 'ab']);
    assert.deepEqual(ranked, ['abc', 'axbyc']);
    assert.deepEqual(rankFuzzy('', ['b', 'a']), ['b', 'a']);
    const rankedFb = rankFuzzy('fb', ['foobar', 'fooBar', 'foo/bar', 'fbar']);
    assert.ok(rankedFb.includes('foobar'));
    assert.ok(rankedFb.includes('foo/bar'));
    assert.ok(scoreFuzzy('fb', 'fbar') > scoreFuzzy('fb', 'foobar'));
    assert.ok(scoreFuzzy('fb', 'fooBar') > scoreFuzzy('fb', 'foobar'));
  });

  it('tracks indices', () => {
    assert.deepEqual(rankFuzzyIndices('abc', ['axbyc', 'abc', 'zzz', 'ab']), [1, 0]);
    assert.deepEqual(rankFuzzyIndices('', ['b', 'a']), [0, 1]);
    assert.deepEqual(rankFuzzyIndices('fo', ['foo', 'foo', 'bar']), [0, 1]);
    assert.deepEqual(filterFuzzyIndices('abc', ['axbyc', 'abc', 'zzz', 'ab']), {
      visible: [1, 0],
      hidden: [2, 3],
    });
    assert.deepEqual(filterFuzzyIndices('', ['b', 'a']), {
      visible: [0, 1],
      hidden: [],
    });
  });

  it('returns match positions', () => {
    const assertMatchPositions = (query, target) => {
      const positions = matchFuzzyPositions(query, target);
      assert.ok(positions);
      assert.equal(positions.length, query.length);
      let last = -1;
      for (let i = 0; i < positions.length; i += 1) {
        const index = positions[i];
        assert.ok(index > last);
        assert.equal(target[index].toLowerCase(), query[i].toLowerCase());
        last = index;
      }
    };

    assertMatchPositions('abc', 'a_b_c');
    assertMatchPositions('fb', 'fooBar');
    assertMatchPositions('rei', 'Rei Ayanami, Neon Genesis');
    assert.deepEqual(matchFuzzyPositions('wan', 'wan/wan'), [0, 1, 2]);
    assert.deepEqual(matchFuzzyPositions('wan', 'wan\\wan'), [0, 1, 2]);
    assert.deepEqual(matchFuzzyPositions('wan gen', 'gen/wan'), [0, 1, 2, 4, 5, 6]);
    assert.equal(matchFuzzyPositions('wan gen', 'wan/other'), null);
    assert.deepEqual(matchFuzzyPositions('', 'abc'), []);
    assert.equal(matchFuzzyPositions('abc', 'def'), null);
  });
});
