export function normalizeSearchQuery(value) {
    return value.trim().toLowerCase();
}
export function toSearchTerms(query) {
    return normalizeSearchQuery(query)
        .split(/\s+/)
        .filter(Boolean);
}
export function joinSearchableText(values) {
    return values
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join("\n")
        .toLowerCase();
}
export function matchesSearchQuery(query, values) {
    const terms = toSearchTerms(query);
    if (terms.length === 0) {
        return true;
    }
    const haystack = joinSearchableText(values);
    return terms.every((term) => haystack.includes(term));
}
//# sourceMappingURL=search.js.map