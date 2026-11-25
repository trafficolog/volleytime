import { PLATFORM_ROLES, type PlatformRole } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  PERMISSION_ROWS,
  assignableRoles,
  initials,
  permissionCell,
  roleInfo,
  staffErrorMessage,
} from './root-team'

const apiError = (statusCode: number, code?: string) => ({
  statusCode,
  data: { data: code ? { code } : {} },
})

describe('roleInfo', () => {
  it('names every role in Russian with a description', () => {
    for (const role of PLATFORM_ROLES) {
      const info = roleInfo(role)
      expect(info.label.length).toBeGreaterThan(0)
      expect(info.ru.length).toBeGreaterThan(0)
      expect(info.description.length).toBeGreaterThan(0)
    }
    expect(roleInfo('owner')).toMatchObject({ label: 'Owner', ru: 'Владелец платформы' })
    expect(roleInfo('analyst')).toMatchObject({ label: 'Analyst', ru: 'Аналитик' })
  })
})

describe('assignableRoles', () => {
  it('does not offer Owner when promoting someone else (reference: only an Owner keeps Owner)', () => {
    expect(assignableRoles('support')).toEqual([
      'admin',
      'finance',
      'moderator',
      'support',
      'analyst',
    ])
  })
  it('offers Owner to a current Owner, and for invitations offers no Owner', () => {
    expect(assignableRoles('owner')).toEqual([...PLATFORM_ROLES])
    expect(assignableRoles(null)).toEqual(['admin', 'finance', 'moderator', 'support', 'analyst'])
  })
})

describe('staffErrorMessage', () => {
  it.each([
    [409, 'platform.staff_last_owner', 'Последнего Owner нельзя понизить или удалить'],
    [409, 'platform.staff_exists', 'Этот человек уже в команде платформы'],
    [409, 'platform.staff_same_role', 'У человека уже эта роль'],
    [409, 'platform.staff_user_ambiguous', 'Найдено несколько пользователей: укажите email'],
    [409, 'platform.staff_user_inactive', 'Пользователь заблокирован: пригласить его нельзя'],
    [404, 'platform.staff_user_not_found', 'Пользователь с таким email или Telegram не найден'],
    [404, 'platform.staff_not_found', 'Этого человека уже нет в команде. Список обновлён'],
    [422, 'validation_failed', 'Укажите email или Telegram-имя и роль'],
    [403, 'forbidden.platform_role', 'Управлять командой может только Owner'],
  ])('%s %s', (status, code, text) => {
    expect(staffErrorMessage(apiError(status, code), 'fallback')).toBe(text)
  })
  it('falls back for unknown failures', () => {
    expect(staffErrorMessage(apiError(500), 'Не удалось. Ещё раз')).toBe('Не удалось. Ещё раз')
  })
})

describe('initials', () => {
  it('takes up to two letters of the name', () => {
    expect(initials('Иван Петров')).toBe('ИП')
    expect(initials('anna')).toBe('AN')
    expect(initials('')).toBe('?')
  })
})

// матрица прав R-15 (карточка 29.3.1): ● полный, «просмотр», — нет; строка выводится из PLATFORM_POLICIES
const F = 'full'
const V = 'view'
const X = 'none'
const MATRIX: Record<string, Array<string>> = {
  // owner admin finance moderator support analyst
  'Обзор платформы': [F, F, V, V, V, V],
  'Организации и функции организаций': [F, F, V, V, V, V],
  'Вход в организацию': [F, F, X, X, X, X],
  'Пользователи и склейка дублей': [F, F, X, V, V, X],
  'Поддержка: обращения, шаблоны, база знаний': [F, F, X, X, F, X],
  'Жалобы игроков': [F, F, X, F, 'передать модератору', X],
  'Страницы групп: скрыть, noindex, вернуть': [F, F, X, F, X, X],
  'Жалобы на страницы': [F, F, X, F, 'отклонить', X],
  'Баланс событий: заявки и выдача': [F, F, F, X, X, V],
  'Тарифы и пакеты': [F, V, V, X, X, V],
  'Подписки и выплаты': [F, V, F, X, X, V],
  Аудит: [F, F, 'свои разделы', 'свои разделы', 'свои разделы', X],
  'Настройки: флаги, лимиты, уведомления': [F, F, X, X, X, X],
  'Команда, безопасность, API': [F, X, X, X, X, X],
}

describe('permission matrix (R-15)', () => {
  it('has exactly the rows of the card, in order', () => {
    expect(PERMISSION_ROWS.map((r) => r.label)).toEqual(Object.keys(MATRIX))
  })
  it('derives every cell of the card matrix from PLATFORM_POLICIES', () => {
    for (const row of PERMISSION_ROWS) {
      const actual = PLATFORM_ROLES.map((role: PlatformRole) => permissionCell(row, role))
      expect({ row: row.label, cells: actual }).toEqual({
        row: row.label,
        cells: MATRIX[row.label],
      })
    }
  })
})
