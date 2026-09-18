// Общая настройка окружения для тестов.
// Значения по умолчанию для локального Postgres (docker compose up -d).
process.env.NODE_ENV ??= 'test'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/volleytime_test'
process.env.DATABASE_URL_TEST ??= process.env.DATABASE_URL
process.env.TELEGRAM_BOT_TOKEN ??= '123456:TEST_TOKEN'
process.env.BETTER_AUTH_SECRET ??= 'test-secret-at-least-32-chars-long'
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000'
process.env.EMAIL_DRIVER ??= 'console'
