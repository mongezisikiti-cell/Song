/**
 * Generates a link to Bible.com (YouVersion) for a given scripture reference and optional version.
 * Updated to use the specific shared link provided by the user.
 */
export function getBibleLink(reference: string, version?: string): string {
  // The user requested all quoted scripture to click through to this specific URL
  return `https://app.bible.com/FCPc/ilyCM8GCtC?add_friend_id=143687545`;
}

/**
 * Maps common translation names to their YouVersion IDs if possible.
 * Updated to use the specific shared link provided by the user.
 */
export function getVersionLink(version: string): string {
  // The user requested all quoted scripture to click through to this specific URL
  return `https://app.bible.com/FCPc/ilyCM8GCtC?add_friend_id=143687545`;
}
