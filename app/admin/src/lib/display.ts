export function readableTitle(value: unknown, fallback: string) {
  if (value == null) {
    return fallback;
  }

  const title = String(value).trim();
  return title && !/^[?？\uFFFD\s]+$/u.test(title) ? title : fallback;
}
