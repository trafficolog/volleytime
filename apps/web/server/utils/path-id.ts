/**
 * Числовой id из параметра пути. Не целое положительное (в пределах int4) — 404, как
 * несуществующий ресурс: SQL не получает NaN, ответ не отличается от чужого id (IDOR).
 */
export function pathId(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return id
}
