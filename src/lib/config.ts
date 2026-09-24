export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function trackingUrl(token: string): string {
  return `${appUrl()}/t/${token}`;
}

export function displayUrl(businessId: string, displayToken: string): string {
  return `${appUrl()}/business/${businessId}/display/${displayToken}`;
}
