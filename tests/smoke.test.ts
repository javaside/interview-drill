import { CONTENT_LIB_VERSION } from '../src/lib/content/index.js'

test('工具链已就位', () => {
  expect(CONTENT_LIB_VERSION).toBe('0.0.0')
})
