import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

function readBuildScript() {
  return readFileSync(path.resolve(import.meta.dirname, 'build-sidecars.ts'), 'utf8')
}

function extractBunTargetForTriple(source: string, triple: string) {
  const match = source.match(new RegExp(`case '${triple}':[\\s\\S]*?return '([^']+)'`))
  return match?.[1] ?? null
}

describe('build-sidecars x64 target mappings', () => {
  it('uses the baseline Bun runtime on macOS x64 so older CPUs do not crash with Illegal Instruction', () => {
    expect(extractBunTargetForTriple(readBuildScript(), 'x86_64-apple-darwin')).toBe(
      'bun-darwin-x64-baseline',
    )
  })

  it('uses the baseline Bun runtime on Windows x64 so older CPUs do not crash with Illegal Instruction', () => {
    expect(extractBunTargetForTriple(readBuildScript(), 'x86_64-pc-windows-msvc')).toBe(
      'bun-windows-x64-baseline',
    )
  })
})
