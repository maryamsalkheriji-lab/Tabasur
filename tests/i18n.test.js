import test from 'node:test'
import assert from 'node:assert/strict'
import { LANG_STORAGE_KEY, readStoredLanguage, saveLanguage, translations } from '../src/lib/i18n.js'

const META_KEYS = /^(code|dir|locale)$/
const arabic = /[؀-ۿ]/

function leaves(value, path = '') {
  if (typeof value === 'function') return [[path, 'function', value]]
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key))
  return [[path, typeof value, value]]
}

test('English mirrors every Arabic key with the same shape', () => {
  const ar = leaves(translations.ar).filter(([path]) => !META_KEYS.test(path))
  const en = leaves(translations.en).filter(([path]) => !META_KEYS.test(path))
  assert.deepEqual(en.map(([path, type]) => [path, type]), ar.map(([path, type]) => [path, type]))
  assert.equal(translations.ar.dir, 'rtl')
  assert.equal(translations.en.dir, 'ltr')
})

test('English copy is really English and nothing is left empty', () => {
  for (const [path, type, value] of leaves(translations.en)) {
    if (type === 'function') { assert.equal(typeof value(3), 'string'); continue }
    assert.ok(String(value).trim().length > 0, `${path} is empty`)
    if (!path.startsWith('toggle.')) assert.ok(!arabic.test(value), `${path} still contains Arabic: ${value}`)
  }
  for (const [path, type, value] of leaves(translations.ar)) {
    if (type !== 'function') assert.ok(String(value).trim().length > 0, `${path} is empty`)
  }
})

test('stored language falls back to Arabic unless English was chosen', () => {
  const memory = new Map()
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  assert.equal(readStoredLanguage(storage), 'ar')
  saveLanguage(storage, 'en')
  assert.equal(memory.get(LANG_STORAGE_KEY), 'en')
  assert.equal(readStoredLanguage(storage), 'en')
  saveLanguage(storage, 'nope')
  assert.equal(readStoredLanguage(storage), 'ar')
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(readStoredLanguage(broken), 'ar')
  assert.doesNotThrow(() => saveLanguage(broken, 'en'))
})
