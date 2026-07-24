export function isDemoDataEnabled() {
  return process.env.LINGBAN_ENABLE_DEMO_DATA?.trim() === "1";
}
