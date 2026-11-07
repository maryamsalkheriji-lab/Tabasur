import test from 'node:test'
import assert from 'node:assert/strict'
import { paginationItems } from '../src/lib/pagination.js'

test('small lists show every page and empty lists have no controls', () => {
  assert.deepEqual(paginationItems(1, 0), [])
  assert.deepEqual(paginationItems(1, 1), [1])
  assert.deepEqual(paginationItems(4, 7), [1, 2, 3, 4, 5, 6, 7])
})

test('67 pages stay compact at the start, middle and end', () => {
  assert.deepEqual(paginationItems(1, 67), [1, 2, 3, 4, 5, 'end-gap', 67])
  assert.deepEqual(paginationItems(33, 67), [1, 'start-gap', 32, 33, 34, 'end-gap', 67])
  assert.deepEqual(paginationItems(67, 67), [1, 'start-gap', 63, 64, 65, 66, 67])
  assert.deepEqual(paginationItems(67, 2), [1, 2])
})

test('every current page remains visible with ordered, bounded navigation', () => {
  for (const total of [8, 9, 20, 67, 1000]) {
    for (let current = 1; current <= total; current++) {
      const items = paginationItems(current, total)
      const pages = items.filter(item => typeof item === 'number')
      assert.ok(items.length <= 7)
      assert.equal(pages[0], 1)
      assert.equal(pages.at(-1), total)
      assert.ok(pages.includes(current))
      assert.equal(new Set(items).size, items.length)
      assert.deepEqual([...pages].sort((a,b) => a-b), pages)
    }
  }
})
