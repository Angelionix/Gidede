# ADR-002: scrypt (не bcrypt) для хеширования паролей

**Дата**: 2026-07-25 · **Статус**: Accepted · **Фаза**: Python→Next.js порт

## Контекст

Оригинальный Python-бэкенд Gidede использовал `bcrypt` для хеширования паролей (через библиотеку `passlib` / `bcrypt`). При порте на Next.js (Node.js runtime) нужно было выбрать функцию хеширования. Варианты:

1. **bcrypt** — популярная библиотека (`bcrypt` npm), но это нативный C++-аддон, требующий сборки (node-gyp, python, visual studio build tools на Windows). Увеличивает размер Docker-образа и усложняет CI.
2. **argon2** — современнее, победитель Password Hashing Competition, но тоже нативный аддон (`argon2` npm) с теми же проблемами сборки.
3. **scrypt** — встроен в Node.js `crypto` module (`scryptSync`), memory-hard, поддерживается без внешних зависимостей. Используется в production (например, в Litecoin).

Требования Gidede: одиночный процесс, файловая SQLite, минимизация зависимостей, простота Docker-сборки. Пароли — не основной вектор атаки (система для геймдизайнеров, не fin-tech), но обязателен timing-safe-сравнение и salt.

## Решение

Использовать **`scryptSync` из встроенного `node:crypto`** (`src/lib/server-auth.ts`):

```ts
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");        // 16-byte salt
  const hash = scryptSync(password, salt, 64).toString("hex"); // 64-byte key
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.startsWith("scrypt$")) return false;      // strict format check
  const [_, salt, expectedHash] = stored.split("$");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);                          // constant-time compare
}
```

Формат хранения: `scrypt$<salt-hex>$<hash-hex>`. Параметры по умолчанию `scryptSync` (N=16384, r=8, p=1) приемлемы для MVP; при росте нагрузки можно вынести в async-версию (`scrypt`) и/или поднять N.

## Последствия

**Положительные:**
- **Ноль внешних зависимостей** — `crypto` встроен в Node.js, не нужно `npm install bcrypt` и собирать нативный аддон.
- Docker-образ (`node:20-slim`) остаётся slim — нет `python3` / `make` / `g++` в build-стадии.
- Cross-platform: работает одинаково на Linux/macOS/Windows без нативных тулчейнов.
- Memory-hard функция (защита от GPU/ASIC-брутфорса), `timingSafeEqual` защищает от timing-атак.
- Формат `scrypt$salt$hash` самодокументируем — легко отличить от legacy/plaintext.

**Отрицательные:**
- `scryptSync` — блокирующий вызов (занимает event loop на ~50–100 мс при N=16384). Для MVP с низкой нагрузкой допустимо; при росте — перейти на async `scrypt(...)` с колбэком/promise.
- Нет встроённой работы с cost-factor в строке (в отличие от bcrypt `$2b$10$...`), но это тривиально добавить префиксом при необходимости ротации параметров.
- Параметры по умолчанию могут оказаться слабее argon2id при равной памяти — но для threat-модели Gidede достаточно.

## История

В Фазе 1 (commit 1db9d70) из `verifyPassword` **удалён plaintext-fallback** для seeded/legacy пользователей: раньше если `stored` не начинался с `scrypt$`, выполнялось прямое строковое сравнение `password === stored` (timing-unsafe + пароль в open-text в БД). Теперь только `scrypt$`-хеши принимаются; мигрируемые пользователи должны сбросить пароль. Комментарий в `schema.prisma` исправлен с `bcrypt` на `scrypt` (Фаза 4, commit c612500).

## Связанные файлы

- `src/lib/server-auth.ts` — `hashPassword`, `verifyPassword`.
- `prisma/schema.prisma` — `User.hashedPassword` (комментарий `scrypt-хеш пароля (scrypt$salt$hash)`).
- `src/app/api/v1/auth/register/route.ts` — вызов `hashPassword` при регистрации.
- `src/app/api/v1/auth/login/route.ts` — вызов `verifyPassword` при логине.
- `src/app/api/v1/auth/change-password/route.ts` — смена пароля.
