/**
 * Операторская команда баланса событий для root (20.2.1, мост до UI 22.2.2/22.2.3).
 *
 * Каждое изменение баланса — строка журнала с автором-оператором (член команды платформы с ролью
 * Owner, Admin или Finance, `platform_staff`, 29.3.1; проверяется в базе; email без учёта регистра) и причиной (комментарий), плюс запись audit_log. Одна операция
 * grant/correct — не больше 1000 событий.
 *
 * Оператор задаётся ровно одним из: `--operator <email>` или `--operator-id <users.id>` (у
 * production-пользователей Telegram email нет). Проверка одна: активный root admin, иначе
 * `forbidden.root_only`; автор в журнале и audit_log — тот же users.id.
 *
 * ВАЖНО: оператор — атрибуция, а не аутентификация. Команда не проверяет, что её запускает именно
 * этот человек: доступ к ней даёт только доступ к серверу и migrator-контейнеру (DATABASE_URL);
 * оператор с таким доступом указывает себя, и это попадает в журнал и audit_log.
 *
 * Изменения идут через appendEventBalanceEntry (блокировка проекции, баланс никогда не уходит в минус). Команда живёт в packages/db, потому что
 * production-образ миграций — единственный с tsx и доступом к БД:
 *
 *   docker compose -f docker-compose.prod.yml run --rm --no-deps migrate \
 *     node ./node_modules/tsx/dist/cli.mjs src/event-balance-operator.ts <command> [options]
 *
 * Локально: `pnpm db:event-balance <command> [options]`.
 *
 * Команды:
 *   grant     --org <id> --units <n> (--operator <root email> | --operator-id <users.id>) --comment "<причина>"
 *   correct   --org <id> --units <±n> (--operator <root email> | --operator-id <users.id>) --comment "<причина>"
 *   approve   --request <id> (--operator <root email> | --operator-id <users.id>) [--comment "<комментарий>"]
 *   reject    --request <id> (--operator <root email> | --operator-id <users.id>) --comment "<причина>"
 *   reconcile (--operator <root email> | --operator-id <users.id>) [--apply] [--since <ISO-дата>]
 *
 * `reconcile` без `--apply` только показывает: расхождение проекции с суммой журнала, организации без
 * стартового начисления (нет ни demo_grant, ни pilot_grant — созданы runtime без баланса), события,
 * опубликованные без списания. С `--apply` выдаёт таким организациям demo-квоту (правило
 * совместимости 5 ADR v3); расхождения и события без списания исправляются только явной командой
 * `correct` по решению оператора.
 */
import { pathToFileURL } from 'node:url'

import type { DB } from './client'
import {
  INT4_MAX,
  type OperatorRef,
  isDbId,
  approvePurchaseRequest,
  grantEventBalance,
  reconcileEventBalance,
  rejectPurchaseRequest,
} from './event-balance-operations'

export * from './event-balance-operations'

export type OperatorArgs =
  | ({ command: 'grant' | 'correct'; org: number; units: number; comment?: string } & OperatorRef)
  | ({ command: 'approve' | 'reject'; request: number; comment?: string } & OperatorRef)
  | ({ command: 'reconcile'; apply?: boolean; since?: string } & OperatorRef)

const USAGE =
  'Usage: event-balance-operator <grant|correct|approve|reject|reconcile> ' +
  '[--org <id>] [--units <n>] [--request <id>] (--operator <root email> | --operator-id <users.id>) [--comment <text>] [--apply] [--since <ISO>]'

const OPTIONS: Record<string, 'int' | 'string' | 'flag'> = {
  org: 'int',
  units: 'int',
  request: 'int',
  operator: 'string',
  'operator-id': 'int',
  comment: 'string',
  since: 'string',
  apply: 'flag',
}

const REQUIRED: Record<OperatorArgs['command'], string[]> = {
  grant: ['org', 'units'],
  correct: ['org', 'units'],
  approve: ['request'],
  reject: ['request'],
  reconcile: [],
}

export function parseOperatorArgs(argv: string[]): OperatorArgs {
  const [command, ...rest] = argv
  if (!command || !(command in REQUIRED)) throw new Error(USAGE)
  const out: Record<string, unknown> = { command }
  for (let i = 0; i < rest.length; i++) {
    const name = rest[i]!.replace(/^--/, '')
    const kind = rest[i]!.startsWith('--') ? OPTIONS[name] : undefined
    if (!kind) throw new Error(`Unknown option ${rest[i]}. ${USAGE}`)
    if (kind === 'flag') {
      out[name] = true
      continue
    }
    const value = rest[++i]
    if (value === undefined) throw new Error(`Missing value for --${name}`)
    if (kind === 'int') {
      if (!/^-?\d+$/.test(value)) {
        throw new Error(
          name === 'operator-id'
            ? '--operator-id must be a positive integer up to 2147483647'
            : `--${name} must be an integer`,
        )
      }
      const n = Number(value)
      if (name === 'operator-id' && !isDbId(n)) {
        throw new Error('--operator-id must be a positive integer up to 2147483647')
      }
      if ((name === 'org' || name === 'request') && n > INT4_MAX) {
        throw new Error(`--${name} must be an integer up to 2147483647`)
      }
      out[name === 'operator-id' ? 'operatorId' : name] = n
    } else {
      out[name] = value
    }
  }
  for (const name of REQUIRED[command as OperatorArgs['command']]) {
    if (out[name] === undefined) throw new Error(`Missing --${name}. ${USAGE}`)
  }
  if ((out.operator === undefined) === (out.operatorId === undefined)) {
    throw new Error(`Specify exactly one of --operator and --operator-id. ${USAGE}`)
  }
  return out as unknown as OperatorArgs
}

export async function runOperatorCommand(database: DB, args: OperatorArgs): Promise<unknown> {
  switch (args.command) {
    case 'grant':
    case 'correct':
      return grantEventBalance(database, {
        organizationId: args.org,
        units: args.units,
        operator: args.operator,
        operatorId: args.operatorId,
        comment: args.comment,
        correction: args.command === 'correct',
      })
    case 'approve':
      return approvePurchaseRequest(database, {
        requestId: args.request,
        operator: args.operator,
        operatorId: args.operatorId,
        comment: args.comment,
      })
    case 'reject':
      return rejectPurchaseRequest(database, {
        requestId: args.request,
        operator: args.operator,
        operatorId: args.operatorId,
        comment: args.comment,
      })
    case 'reconcile': {
      const since = args.since ? new Date(args.since) : undefined
      if (since && Number.isNaN(since.getTime())) throw new Error('--since must be an ISO date')
      return reconcileEventBalance(database, {
        operator: args.operator,
        operatorId: args.operatorId,
        apply: args.apply === true,
        since,
      })
    }
  }
}

async function main(): Promise<void> {
  const args = parseOperatorArgs(process.argv.slice(2))
  const { db, closeDb } = await import('./client')
  try {
    console.log(JSON.stringify(await runOperatorCommand(db, args), null, 2))
  } finally {
    await closeDb()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
