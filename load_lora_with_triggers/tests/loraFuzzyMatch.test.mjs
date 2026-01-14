import assert from 'node:assert/strict';

import {
	filterFuzzyIndices,
	matchFuzzyPositions,
	rankFuzzy,
	rankFuzzyIndices,
	scoreFuzzy,
} from '../../web/load_lora_with_triggers/js/loraFuzzyMatch.js';

assert.equal(scoreFuzzy('abc', 'def'), Number.NEGATIVE_INFINITY);
assert.ok(scoreFuzzy('abc', 'a_x_b_x_c') > Number.NEGATIVE_INFINITY);
assert.equal(scoreFuzzy('abc', 'AbC'), Number.POSITIVE_INFINITY);
assert.equal(scoreFuzzy('', 'abc'), 0);

assert.ok(scoreFuzzy('fb', 'fooBar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'foo/bar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'foo_bar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'foo-bar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'foo bar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'foo.bar') > scoreFuzzy('fb', 'foobar'));

assert.equal(scoreFuzzy('a', ''), Number.NEGATIVE_INFINITY);
assert.equal(scoreFuzzy('abc', 'ab'), Number.NEGATIVE_INFINITY);
assert.equal(scoreFuzzy('a', 'a'), Number.POSITIVE_INFINITY);
assert.equal(scoreFuzzy('a', 'A'), Number.POSITIVE_INFINITY);
assert.ok(scoreFuzzy('a', 'a123') > scoreFuzzy('a', 'ba123'));
assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'a_b_c'));
assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'a__bc'));
assert.ok(scoreFuzzy('abc', 'abc') > scoreFuzzy('abc', 'ab__c'));

const ranked = rankFuzzy('abc', ['axbyc', 'abc', 'zzz', 'ab']);
assert.deepEqual(ranked, ['abc', 'axbyc']);
assert.deepEqual(rankFuzzy('', ['b', 'a']), ['b', 'a']);
const rankedFb = rankFuzzy('fb', ['foobar', 'fooBar', 'foo/bar', 'fbar']);
assert.equal(rankedFb[rankedFb.length - 1], 'foobar');
assert.ok(scoreFuzzy('fb', 'fbar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'fooBar') > scoreFuzzy('fb', 'foobar'));
assert.ok(scoreFuzzy('fb', 'foo/bar') > scoreFuzzy('fb', 'foobar'));

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
assertMatchPositions('rei ne', 'Rei Ayanami, Neon Genesis');
assert.deepEqual(matchFuzzyPositions('', 'abc'), []);
assert.equal(matchFuzzyPositions('abc', 'def'), null);
