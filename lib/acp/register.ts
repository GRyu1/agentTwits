import { access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Address } from 'viem'

const execFileAsync = promisify(execFile)

export interface AcpRegistrationInput {
  agentId: string
  ownerAddress: Address
  agentWalletAddress?: Address
  cdpWalletAddress?: Address
  agentDomain?: string
}

export interface AcpRegistrationResult {
  status: 'REGISTERED' | 'SKIPPED' | 'FAILED'
  agentName?: string
  walletAddress?: Address
  profile?: unknown
  error?: string
}

function autoRegisterEnabled() {
  return process.env.ACP_AUTO_REGISTER !== 'false'
}

function skillDir() {
  return process.env.ACP_SKILL_DIR || '/Users/gryu0603/.codex/skills/openclaw-acp'
}

async function hasLocalAcpSkill() {
  try {
    await access(`${skillDir()}/package.json`)
    await access(`${skillDir()}/bin/acp.ts`)
    return true
  } catch {
    return false
  }
}

function buildAgentName(input: AcpRegistrationInput) {
  const prefix = process.env.ACP_AGENT_NAME_PREFIX || 'fearnet'
  const suffix = input.agentId || input.ownerAddress.slice(2, 8)
  return `${prefix}-${suffix}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48)
}

async function runAcp(args: string[]) {
  const timeout = Number(process.env.ACP_CLI_TIMEOUT_MS || 15_000)

  if (process.env.ACP_CLI_COMMAND) {
    const prefix = process.env.ACP_CLI_ARGS_PREFIX
      ? process.env.ACP_CLI_ARGS_PREFIX.split(' ').filter(Boolean)
      : []
    return execFileAsync(process.env.ACP_CLI_COMMAND, [...prefix, ...args], {
      cwd: process.cwd(),
      timeout,
      maxBuffer: 1024 * 1024,
    })
  }

  if (await hasLocalAcpSkill()) {
    return execFileAsync('npm', ['--prefix', skillDir(), 'run', '-s', 'acp', '--', ...args], {
      cwd: process.cwd(),
      timeout,
      maxBuffer: 1024 * 1024,
    })
  }

  return execFileAsync('acp', args, {
    cwd: process.cwd(),
    timeout,
    maxBuffer: 1024 * 1024,
  })
}

function parseJson(stdout: string) {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  const objectStart = trimmed.indexOf('{')
  const arrayStart = trimmed.indexOf('[')
  const jsonStart = objectStart === -1 ? arrayStart : arrayStart === -1 ? objectStart : Math.min(objectStart, arrayStart)
  if (jsonStart < 0) return null
  return JSON.parse(trimmed.slice(jsonStart))
}

async function acpJson(args: string[]) {
  const { stdout } = await runAcp([...args, '--json'])
  return parseJson(stdout)
}

export async function registerAgentOnAcp(input: AcpRegistrationInput): Promise<AcpRegistrationResult> {
  if (!autoRegisterEnabled()) {
    return { status: 'SKIPPED', error: 'ACP_AUTO_REGISTER=false' }
  }

  const agentName = buildAgentName(input)
  try {
    let created: unknown
    try {
      created = await acpJson(['agent', 'create', agentName])
    } catch (e: any) {
      const message = `${e?.stderr || e?.stdout || e?.message || e}`.trim()
      if (!/already|exist|duplicate/i.test(message)) throw e
      created = await acpJson(['agent', 'switch', agentName])
    }

    const description = [
      'FearNet trading agent on Base Sepolia.',
      `ERC-8004 agentId=${input.agentId}.`,
      input.agentWalletAddress ? `AgentWallet=${input.agentWalletAddress}.` : '',
      input.cdpWalletAddress ? `AgentKit/CDP wallet=${input.cdpWalletAddress}.` : '',
      'Uses Nansen signals, FLock decisions, x402 settlement, and PancakeSwap V3 execution.',
    ].filter(Boolean).join(' ')

    let profile: unknown
    try {
      profile = await acpJson(['profile', 'update', 'description', description])
    } catch {
      profile = created
    }

    let walletAddress: Address | undefined
    try {
      const wallet = await acpJson(['wallet', 'address'])
      const candidate = wallet?.address || wallet?.walletAddress
      if (typeof candidate === 'string' && candidate.startsWith('0x')) walletAddress = candidate as Address
    } catch {}

    return {
      status: 'REGISTERED',
      agentName,
      walletAddress,
      profile,
    }
  } catch (e: any) {
    const error = `${e?.stderr || e?.stdout || e?.message || e}`.trim()
    return {
      status: 'FAILED',
      agentName,
      error: error.slice(0, 500),
    }
  }
}
