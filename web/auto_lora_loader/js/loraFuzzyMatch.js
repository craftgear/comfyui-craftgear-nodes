const normalizeText = (text) => text.toLowerCase();

const isBoundary = (char) => char === '/' || char === '_' || char === '-' || char === ' ' || char === '.';

const scoreToken = (query, target) => {
	if (!query) {
		return 0;
	}

	let score = 0;
	let targetIndex = 0;
	let consecutive = 0;

	for (let i = 0; i < query.length; i += 1) {
		const qChar = query[i];
		const found = target.indexOf(qChar, targetIndex);
		if (found === -1) {
			return Number.NEGATIVE_INFINITY;
		}

		if (found === targetIndex) {
			consecutive += 1;
			score += 12 + consecutive * 4;
		} else {
			consecutive = 0;
			score += 10;
			score -= Math.min(12, found - targetIndex);
		}

		if (found === 0 || isBoundary(target[found - 1])) {
			score += 6;
		}

		targetIndex = found + 1;
	}

	score += Math.max(0, 20 - target.length * 0.2);
	return score;
};

export const scoreFuzzy = (query, target) => {
	const trimmed = query.trim();
	if (!trimmed) {
		return 0;
	}

	const normalizedQuery = normalizeText(trimmed);
	const normalizedTarget = normalizeText(target);
	const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

	let total = 0;
	for (const token of tokens) {
		if (!normalizedTarget.includes(token)) {
			return Number.NEGATIVE_INFINITY;
		}
		const tokenScore = scoreToken(token, normalizedTarget);
		if (tokenScore === Number.NEGATIVE_INFINITY) {
			return Number.NEGATIVE_INFINITY;
		}
		total += tokenScore;
	}

	return total;
};

export const rankFuzzy = (query, items) => {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		return items.slice();
	}

	const scored = items
		.map((item, index) => ({ item, index, score: scoreFuzzy(normalizedQuery, item) }))
		.filter((entry) => entry.score !== Number.NEGATIVE_INFINITY)
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return a.index - b.index;
		});

	return scored.map((entry) => entry.item);
};
