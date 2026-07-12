export function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

export function toSearchTerms(query: string) {
  return normalizeSearchQuery(query)
    .split(/\s+/)
    .filter(Boolean);
}

export function joinSearchableText(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

export function matchesSearchQuery(
  query: string,
  values: Array<string | null | undefined>
) {
  const terms = toSearchTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = joinSearchableText(values);
  return terms.every((term) => haystack.includes(term));
}
