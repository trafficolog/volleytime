-- Создаёт тестовую БД при первом старте контейнера
SELECT 'CREATE DATABASE volleytime_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'volleytime_test')\gexec
