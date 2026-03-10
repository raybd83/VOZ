import * as idb from 'idb-keyval';

export const loadRules = async () => {
  const rules = await idb.get('rules');
  return rules || [];
};

export const saveRules = async (rules) => {
  await idb.set('rules', rules);
};

export const loadGlossary = async () => {
  const gloss = await idb.get('glossary');
  return gloss || [];
};

export const saveGlossary = async (gloss) => {
  await idb.set('glossary', gloss);
};
