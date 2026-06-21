export function isDebugApiEnabled(): boolean {
  return process.env.DEBUG_API_RESPONSE === 'true';
}
