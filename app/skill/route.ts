// Serves skill.md as plain text so Claude Code / Cursor / custom agents can
// fetch it directly: `curl https://fearnet.app/skill > ~/.claude/skills/fearnet.md`

import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const body = readFileSync(join(process.cwd(), 'skill.md'), 'utf8')
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  })
}
