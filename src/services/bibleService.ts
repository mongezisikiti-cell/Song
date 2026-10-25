export interface BibleVerse {
  reference: string;
  text: string;
  translation_name: string;
  translation_id: string;
}

export const COMMON_TRANSLATIONS = [
  { id: 'kjv', name: 'King James Version' },
  { id: 'web', name: 'World English Bible' },
  { id: 'bbe', name: 'Bible in Basic English' },
  { id: 'oeb-us', name: 'Open English Bible (US)' }
];

export async function lookupScripture(reference: string, translationId: string = 'web'): Promise<BibleVerse | null> {
  try {
    const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=${translationId}`);
    if (!response.ok) {
      throw new Error('Scripture not found');
    }
    const data = await response.json();
    return {
      reference: data.reference,
      text: data.text,
      translation_name: data.translation_name,
      translation_id: translationId
    };
  } catch (error) {
    console.error('Error looking up scripture:', error);
    return null;
  }
}

export async function lookupAlternativeTranslations(reference: string): Promise<BibleVerse[]> {
  const results: BibleVerse[] = [];
  // Fetch a few common ones in parallel
  const translationsToFetch = ['kjv', 'bbe', 'oeb-us'];
  
  const promises = translationsToFetch.map(id => lookupScripture(reference, id));
  const responses = await Promise.all(promises);
  
  responses.forEach(res => {
    if (res) results.push(res);
  });
  
  return results;
}
