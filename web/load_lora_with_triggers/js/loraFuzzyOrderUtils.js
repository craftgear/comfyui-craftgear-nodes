export const buildFuzzyReindexMap = (orderedIndices) => {
	const result = {};
	orderedIndices.forEach((index, order) => {
		result[index] = order;
	});
	return result;
};
