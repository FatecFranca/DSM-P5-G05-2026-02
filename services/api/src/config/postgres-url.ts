export function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'postgresql:' || url.protocol === 'postgres:') &&
      url.hostname.length > 0 &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}
