const SCORE_MIN = Number.NEGATIVE_INFINITY;
const SCORE_MAX = Number.POSITIVE_INFINITY;

const SCORE_GAP_LEADING = -0.005;
const SCORE_GAP_TRAILING = -0.005;
const SCORE_GAP_INNER = -0.01;

const SCORE_MATCH_CONSECUTIVE = 1.0;
const SCORE_MATCH_START = 0.9;
const SCORE_MATCH_WORD = 0.8;
const SCORE_MATCH_CAPITAL = 0.7;
const SCORE_MATCH_DOT = 0.6;

const MATCH_MAX_LEN = 1024;

const isLower = (code) => code >= 97 && code <= 122;
const isUpper = (code) => code >= 65 && code <= 90;
const isDigit = (code) => code >= 48 && code <= 57;

const splitQueryTokens = (query) => {
	const trimmed = String(query ?? '').trim();
	if (!trimmed) {
		return [];
	}
	return trimmed.split(/\s+/);
};

const computeBonus = (lastChar, currentChar) => {
	const currentCode = currentChar.charCodeAt(0);
	if (!(isUpper(currentCode) || isLower(currentCode) || isDigit(currentCode))) {
		return 0;
	}

	if (lastChar === '') {
		return SCORE_MATCH_START;
	}
	if (lastChar === '-' || lastChar === '_' || lastChar === ' ' || lastChar === '/' || lastChar === '\\') {
		return SCORE_MATCH_WORD;
	}
	if (lastChar === '.') {
		return SCORE_MATCH_DOT;
	}

	if (isUpper(currentCode)) {
		const lastCode = lastChar.charCodeAt(0);
		if (isLower(lastCode)) {
			return SCORE_MATCH_CAPITAL;
		}
	}

	return 0;
};

const buildBonus = (haystack) => {
	const bonus = new Array(haystack.length);
	let lastChar = '';
	for (let i = 0; i < haystack.length; i += 1) {
		const currentChar = haystack[i];
		bonus[i] = computeBonus(lastChar, currentChar);
		lastChar = currentChar;
	}
	return bonus;
};

const hasMatch = (needle, haystack) => {
	const lowerNeedle = needle.toLowerCase();
	const lowerHaystack = haystack.toLowerCase();
	let haystackIndex = 0;

	for (let i = 0; i < lowerNeedle.length; i += 1) {
		const found = lowerHaystack.indexOf(lowerNeedle[i], haystackIndex);
		if (found === -1) {
			return false;
		}
		haystackIndex = found + 1;
	}

	return true;
};

const matchRow = (context, row, currD, currM, lastD, lastM) => {
	const { lowerNeedle, lowerHaystack, matchBonus, needleLength, haystackLength } = context;
	const gapScore = row === needleLength - 1 ? SCORE_GAP_TRAILING : SCORE_GAP_INNER;
	let prevScore = SCORE_MIN;
	let prevD = SCORE_MIN;
	let prevM = SCORE_MIN;
	const needleChar = lowerNeedle[row];

	for (let j = 0; j < haystackLength; j += 1) {
		let score = SCORE_MIN;
		if (needleChar === lowerHaystack[j]) {
			if (row === 0) {
				score = (j * SCORE_GAP_LEADING) + matchBonus[j];
			} else if (j > 0) {
				score = Math.max(prevM + matchBonus[j], prevD + SCORE_MATCH_CONSECUTIVE);
			}
		}

		const lastDValue = lastD[j];
		const lastMValue = lastM[j];

		currD[j] = score;
		prevScore = Math.max(score, prevScore + gapScore);
		currM[j] = prevScore;
		prevD = lastDValue;
		prevM = lastMValue;
	}
};

const matchScore = (needle, haystack) => {
	if (!needle) {
		return SCORE_MIN;
	}

	const needleLength = needle.length;
	const haystackLength = haystack.length;

	if (needleLength > haystackLength) {
		return SCORE_MIN;
	}
	if (haystackLength > MATCH_MAX_LEN) {
		return SCORE_MIN;
	}
	if (!hasMatch(needle, haystack)) {
		return SCORE_MIN;
	}
	if (needleLength === haystackLength) {
		return SCORE_MAX;
	}

	const lowerNeedle = needle.toLowerCase();
	const lowerHaystack = haystack.toLowerCase();
	const matchBonus = buildBonus(haystack);
	const D = new Array(haystackLength).fill(SCORE_MIN);
	const M = new Array(haystackLength).fill(SCORE_MIN);
	const context = { lowerNeedle, lowerHaystack, matchBonus, needleLength, haystackLength };

	for (let row = 0; row < needleLength; row += 1) {
		matchRow(context, row, D, M, D, M);
	}

	return M[haystackLength - 1];
};

const matchPositions = (needle, haystack) => {
	if (!needle) {
		return [];
	}

	const needleLength = needle.length;
	const haystackLength = haystack.length;

	if (needleLength > haystackLength) {
		return null;
	}
	if (haystackLength > MATCH_MAX_LEN) {
		return null;
	}
	if (!hasMatch(needle, haystack)) {
		return null;
	}
	if (needleLength === haystackLength) {
		return Array.from({ length: needleLength }, (_value, index) => index);
	}

	const lowerNeedle = needle.toLowerCase();
	const lowerHaystack = haystack.toLowerCase();
	const matchBonus = buildBonus(haystack);
	const D = Array.from({ length: needleLength }, () => new Array(haystackLength).fill(SCORE_MIN));
	const M = Array.from({ length: needleLength }, () => new Array(haystackLength).fill(SCORE_MIN));
	const DFrom = Array.from({ length: needleLength }, () => new Array(haystackLength).fill(-1));
	const MFrom = Array.from({ length: needleLength }, () => new Array(haystackLength).fill(0));

	for (let i = 0; i < needleLength; i += 1) {
		const gapScore = i === needleLength - 1 ? SCORE_GAP_TRAILING : SCORE_GAP_INNER;
		for (let j = 0; j < haystackLength; j += 1) {
			if (lowerNeedle[i] === lowerHaystack[j]) {
				if (i === 0) {
					D[i][j] = (j * SCORE_GAP_LEADING) + matchBonus[j];
					DFrom[i][j] = -1;
				} else if (j > 0) {
					const fromM = M[i - 1][j - 1] + matchBonus[j];
					const fromD = D[i - 1][j - 1] + SCORE_MATCH_CONSECUTIVE;
					if (fromM >= fromD) {
						D[i][j] = fromM;
						DFrom[i][j] = 0;
					} else {
						D[i][j] = fromD;
						DFrom[i][j] = 1;
					}
				}
			}

			if (j === 0) {
				M[i][j] = D[i][j];
				MFrom[i][j] = D[i][j] > SCORE_MIN ? 1 : 0;
			} else {
				const fromM = M[i][j - 1] + gapScore;
				const fromD = D[i][j];
				if (fromD >= fromM) {
					M[i][j] = fromD;
					MFrom[i][j] = 1;
				} else {
					M[i][j] = fromM;
					MFrom[i][j] = 0;
				}
			}
		}
	}

	if (M[needleLength - 1][haystackLength - 1] === SCORE_MIN) {
		return null;
	}

	const positions = [];
	let i = needleLength - 1;
	let j = haystackLength - 1;
	let state = 'M';

	while (i >= 0 && j >= 0) {
		if (state === 'M') {
			if (MFrom[i][j] === 1) {
				state = 'D';
			} else {
				j -= 1;
			}
			continue;
		}

		positions.push(j);
		if (i === 0) {
			break;
		}
		const from = DFrom[i][j];
		i -= 1;
		j -= 1;
		state = from === 1 ? 'D' : 'M';
	}

	positions.reverse();
	return positions.length === needleLength ? positions : null;
};

export const scoreFuzzy = (query, target) => {
	const tokens = splitQueryTokens(query);
	if (tokens.length === 0) {
		return 0;
	}
	if (!target) {
		return SCORE_MIN;
	}
	if (tokens.length === 1) {
		return matchScore(tokens[0], target);
	}
	let total = 0;
	for (const token of tokens) {
		const score = matchScore(token, target);
		if (score === SCORE_MIN) {
			return SCORE_MIN;
		}
		total += score;
	}
	return total;
};

export const matchFuzzyPositions = (query, target) => {
	const tokens = splitQueryTokens(query);
	if (tokens.length === 0) {
		return [];
	}
	if (!target) {
		return null;
	}
	if (tokens.length === 1) {
		return matchPositions(tokens[0], target);
	}
	const matches = new Set();
	for (const token of tokens) {
		const positions = matchPositions(token, target);
		if (!positions) {
			return null;
		}
		positions.forEach((index) => matches.add(index));
	}
	return Array.from(matches).sort((a, b) => a - b);
};

export const rankFuzzy = (query, items) => {
	const normalizedQuery = String(query ?? '').trim();
	if (!normalizedQuery) {
		return items.slice();
	}

	const scored = items
		.map((item, index) => ({ item, index, score: scoreFuzzy(normalizedQuery, item) }))
		.filter((entry) => entry.score !== SCORE_MIN)
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return a.index - b.index;
		});

	return scored.map((entry) => entry.item);
};

export const rankFuzzyIndices = (query, items) => {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		return items.map((_item, index) => index);
	}

	const ranked = rankFuzzy(normalizedQuery, items);
	const indicesByLabel = new Map();

	items.forEach((item, index) => {
		const existing = indicesByLabel.get(item);
		if (existing) {
			existing.push(index);
			return;
		}
		indicesByLabel.set(item, [index]);
	});

	const result = [];
	for (const item of ranked) {
		const indices = indicesByLabel.get(item);
		if (!indices || indices.length === 0) {
			continue;
		}
		result.push(indices.shift());
	}

	return result;
};

export const filterFuzzyIndices = (query, items) => {
	const visible = rankFuzzyIndices(query, items);
	const visibleSet = new Set(visible);
	const hidden = [];

	for (let i = 0; i < items.length; i += 1) {
		if (!visibleSet.has(i)) {
			hidden.push(i);
		}
	}

	return { visible, hidden };
};
