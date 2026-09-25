export function groupCreateHref(isAuthenticated: boolean | null): string {
  return isAuthenticated === true ? '/m/orgs/create' : '/auth/login?redirect=%2Fm%2Forgs%2Fcreate'
}

export function telegramBotHref(raw: string): string | null {
  const name = raw.trim().replace(/^@/, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(name) ? `https://t.me/${name}` : null
}

export const landingSections = [
  { id: 'features', label: 'Возможности' },
  { id: 'how-it-works', label: 'Как работает' },
  { id: 'faq', label: 'Вопросы' },
] as const

export const landingFeatures = [
  {
    title: 'Запись и лист ожидания',
    body: 'Игроки видят места и записываются; при освобождении места очередь обновляется.',
  },
  {
    title: 'Оплаты и касса',
    body: 'Организатор отмечает наличные или перевод, подтверждает оплату и видит движения кассы.',
  },
  {
    title: 'Абонементы по выбору группы',
    body: 'Группа может включить абонементы; организатор управляет планами и остатками.',
  },
  {
    title: 'Расписание и состав',
    body: 'Создавайте события и проверяйте состав участников в одном месте.',
  },
] as const

export const landingFaq = [
  {
    question: 'Нужно ли устанавливать приложение?',
    answer: 'Нет. Игрок открывает Mini App в Telegram по приглашению группы.',
  },
  {
    question: 'Как учитываются оплаты?',
    answer: 'Организатор отмечает наличные или перевод и подтверждает оплату в приложении.',
  },
  {
    question: 'Что происходит при отмене записи?',
    answer: 'Освободившееся место может перейти следующему игроку из листа ожидания.',
  },
  {
    question: 'Как создать группу?',
    answer:
      'Войдите по email и заполните форму создания группы, затем отправьте приглашение игрокам.',
  },
] as const
