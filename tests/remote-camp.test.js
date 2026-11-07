import test from 'node:test'
import assert from 'node:assert/strict'
import { driveFolderUrl, isCurrentPreviewConsent, makePreviewConsent, PUBLICATION_POLICY, readLibraryUrl, REMOTE_STORAGE_KEY, saveLibraryUrl, selectVideos } from '../src/lib/remote-camp.js'
const folder = 'https://drive.google.com/drive/folders/1ExampleFolderId_123'
const video = { name: 'city.mp4', type: 'video/mp4', size: 2048, lastModified: 1 }

test('Normalize Drive folders while preserving access keys and rejecting spoofed URLs', () => {
  assert.equal(driveFolderUrl(' https://drive.google.com/drive/u/2/folders/1ExampleFolderId_123?usp=sharing&resourcekey=0-key '), `${folder}?resourcekey=0-key`)
  for (const url of ['javascript:alert(1)', 'http://drive.google.com/drive/folders/1ExampleFolderId_123', 'https://drive.google.com.evil.test/drive/folders/1ExampleFolderId_123', 'https://user:pass@drive.google.com/drive/folders/1ExampleFolderId_123', 'https://drive.google.com/file/d/1ExampleFolderId_123/view']) assert.equal(driveFolderUrl(url), null)
})

test('A shared source setting survives reload without reviving old registrations', () => {
  const memory = new Map([['tabsur-remote-preview-v1', JSON.stringify({ settings: { libraryUrl: folder }, registration: { name: 'Old User' } })]])
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  assert.equal(readLibraryUrl(storage), folder)
  assert.equal(saveLibraryUrl(storage, ''), '')
  assert.equal(readLibraryUrl(storage), '')
  assert.equal(saveLibraryUrl(storage, folder), folder)
  assert.deepEqual(JSON.parse(memory.get(REMOTE_STORAGE_KEY)), { libraryUrl: folder })
  assert.throws(() => saveLibraryUrl(storage, 'https://evil.test'))
  memory.set(REMOTE_STORAGE_KEY, 'broken json')
  assert.equal(readLibraryUrl(storage), '')
})

test('Video selection rejects empty and non-video files and deduplicates within each track', () => {
  const result = selectVideos([video], [video, { ...video, name: 'next.mov', type: '' }, { name: 'notes.txt', type: 'text/plain', size: 30 }, { ...video, name: 'empty.mp4', size: 0 }, { ...video, name: 'fake.mp4', type: 'text/html' }])
  assert.equal(result.accepted.length, 1)
  assert.equal(result.duplicates, 1)
  assert.equal(result.rejected.length, 3)
  assert.equal(selectVideos([], [video]).accepted.length, 1, 'Same file can be attached to a different track')
})

test('100 selected videos retain their actual objects and stable ordering without reading their bytes', () => {
  const files = Array.from({ length: 100 }, (_, i) => ({ ...video, name: `${i}.mp4` }))
  const result = selectVideos([], files)
  assert.equal(result.accepted.length, 100)
  assert.equal(result.accepted[99], files[99])
  assert.deepEqual(result.rejected, [])
})

test('Blocked storage does not prevent viewing the page or silently report a saved setting', () => {
  const storage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readLibraryUrl(storage), '')
  assert.throws(() => saveLibraryUrl(storage, folder), /blocked/)
})

test('Publication consent requires an explicit opt-in and is scoped to the current track and exact terms', () => {
  for (const flag of [false, undefined, 'true', 1]) assert.equal(makePreviewConsent(flag, 'life'), null)
  assert.equal(makePreviewConsent(true, 'unknown'), null)
  assert.equal(makePreviewConsent(true, 'life', 'invalid'), null)
  const consent = makePreviewConsent(true, 'life', '2026-11-01T10:00:00.000Z')
  assert.equal(isCurrentPreviewConsent(consent, 'life'), true)
  assert.equal(consent.beneficiary, 'أمانة منطقة المدينة المنورة')
  assert.equal(consent.version, PUBLICATION_POLICY.version)
  assert.ok(consent.text.includes('سواء فازت'))
  assert.ok(consent.text.includes('إذن بالنشر فقط'))
  assert.equal(consent.localOnly, true)
  assert.equal(isCurrentPreviewConsent(consent, 'identity'), false)
  assert.equal(isCurrentPreviewConsent({ ...consent, version: 'old' }, 'life'), false)
  assert.equal(isCurrentPreviewConsent({ ...consent, text: 'different terms' }, 'life'), false)
  assert.equal(isCurrentPreviewConsent({ ...consent, beneficiary: 'different entity' }, 'life'), false)
  assert.equal(isCurrentPreviewConsent(null, 'life'), false)
})

test('English consent records the English policy text under the same version', () => {
  const consent = makePreviewConsent(true, 'life', '2026-11-01T10:00:00.000Z', 'en')
  assert.equal(consent.language, 'en')
  assert.equal(consent.version, PUBLICATION_POLICY.version)
  assert.ok(consent.text.includes('permission to publish only'))
  assert.equal(isCurrentPreviewConsent(consent, 'life'), true)
  assert.equal(isCurrentPreviewConsent({ ...consent, language: 'ar' }, 'life'), false)
  assert.equal(makePreviewConsent(true, 'life', '2026-11-01T10:00:00.000Z', 'fr'), null)
})
