// Pure: the lookup key of a term. Trim, collapse inner whitespace, lowercase.
export const cacheKey = (term: string): string => term.trim().replace(/\s+/g, ' ').toLowerCase();
