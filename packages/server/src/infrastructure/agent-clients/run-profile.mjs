import { sanitizeTaskType } from '#domains/agents/task-type-config.mjs'
import { getAgentSystemPrompt } from './config.mjs'

export const CLAUDE_ASK_MODE_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'Bash',
  'WebSearch',
  'WebFetch',
  'AskUserQuestion',
]

const CLAUDE_ASK_MODE_TOOL_SET = new Set(CLAUDE_ASK_MODE_TOOLS)
const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'status',
  'diff',
  'log',
  'show',
  'grep',
  'rev-parse',
  'ls-files',
  'blame',
])

export function extractShellCommand(input) {
  if (!input || typeof input !== 'object') return ''
  if (typeof input.command === 'string') return input.command
  if (typeof input.cmd === 'string') return input.cmd
  if (Array.isArray(input.command)) return input.command.join(' ')
  if (Array.isArray(input.argv)) return input.argv.join(' ')
  return ''
}

function normalizeCommand(command) {
  return command
    .trim()
    .replace(/^sudo\s+/, '')
    .replace(/^[()]+|[()]+$/g, '')
}

function isReadOnlyGitCommand(command) {
  const trimmed = normalizeCommand(command)
  if (!trimmed.startsWith('git ')) return false
  const [, subcommand = ''] = trimmed.split(/\s+/, 2)
  return READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)
}

export function isMutatingShellCommand(command) {
  const normalized = normalizeCommand(command)
  if (!normalized) return false

  if (isReadOnlyGitCommand(normalized)) {
    return false
  }
  if (/^git\b/.test(normalized)) {
    return true
  }

  if (/\|\s*tee\b/.test(normalized)) {
    return true
  }

  if (
    /(^|[;&|]\s*)(cp|mv|rm|mkdir|rmdir|touch|chmod|chown|ln|install|dd|truncate|patch)\b/.test(
      normalized
    )
  ) {
    return true
  }

  if (/\b(npm|pnpm|yarn|bun)\s+(install|add|remove|update|upgrade|create|dlx)\b/.test(normalized)) {
    return true
  }

  if (/\b(sed|perl)\b[^\n]*\s-i\b/.test(normalized)) {
    return true
  }

  return false
}

export async function canUseClaudeAskModeTool(toolName, input) {
  if (!CLAUDE_ASK_MODE_TOOL_SET.has(toolName)) {
    return {
      behavior: 'deny',
      message: `Ask mode only allows read-only tools. Blocked tool: ${toolName}.`,
      decisionClassification: 'user_reject',
    }
  }

  if (toolName !== 'Bash') {
    return {
      behavior: 'allow',
      decisionClassification: 'user_temporary',
    }
  }

  const command = extractShellCommand(input)
  if (isMutatingShellCommand(command)) {
    return {
      behavior: 'deny',
      message: `Ask mode blocks mutating shell commands. Blocked command: ${command}.`,
      decisionClassification: 'user_reject',
    }
  }

  return {
    behavior: 'allow',
    decisionClassification: 'user_temporary',
  }
}

export function resolveAgentRunProfile(task) {
  const mode = task?.mode ?? 'code'
  const taskType = sanitizeTaskType(task?.task_type ?? task?.taskType)
  const developerInstructions = getAgentSystemPrompt({ mode, taskType })
  const isAskMode = mode === 'ask'

  return {
    mode,
    taskType,
    developerInstructions,
    claude: {
      systemPrompt: developerInstructions
        ? {
            type: 'preset',
            preset: 'claude_code',
            append: developerInstructions,
          }
        : undefined,
      permissionMode: isAskMode ? 'default' : 'bypassPermissions',
      allowDangerouslySkipPermissions: !isAskMode,
      tools: isAskMode ? CLAUDE_ASK_MODE_TOOLS : undefined,
      allowedTools: isAskMode ? CLAUDE_ASK_MODE_TOOLS : undefined,
      canUseTool: isAskMode ? canUseClaudeAskModeTool : undefined,
    },
    codex: {
      approvalPolicy: isAskMode ? 'on-request' : 'never',
      sandbox: isAskMode ? 'read-only' : 'danger-full-access',
      developerInstructions,
    },
  }
}
