import { MONO_FONT } from '@tastic/hud'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

import { titleType } from '@/hero/fonts'
import { pack } from '@/pack'

// The pack's titles are in the wordmark's monospace (hud's MONO_FONT): the shell's and the packages' titles through the pack's
// titleStyle (hero/fonts.ts), and the titles PuckTastic draws itself (the Game Over cards, the paddle scores) by hand.

const SRC = join(__dirname, '..')

/** Every app source file (tests and mocks left out). */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === '__mocks__' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe("the pack's lettering", () => {
  it("hands the shell the wordmark's monospace for every title, and no label lettering", () => {
    expect(pack.titleStyle).toBe(titleType)
    expect(titleType.fontFamily).toBe(MONO_FONT)
    // Each title keeps its own size and weight
    expect(Object.keys(titleType)).toEqual(['fontFamily'])
    expect(pack.labelStyle).toBeUndefined()
  })

  it('draws every title of its own in the same monospace', () => {
    const offenders = sourceFiles().flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => /variant=['"](display|headline|title)[A-Za-z]*['"]/.test(line) && !/MONO_FONT|titleType/.test(line))
        .map(({ at }) => at)
    )
    expect(offenders).toEqual([])
  })

  it("takes the monospace from hud's one MONO_FONT, never a copy", () => {
    const copies = sourceFiles().filter((file) => /ios:\s*['"]Menlo['"]/.test(readFileSync(file, 'utf8')))
    expect(copies.map((file) => relative(SRC, file))).toEqual([])
  })
})
