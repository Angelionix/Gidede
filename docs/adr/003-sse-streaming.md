# ADR-003: SSE (не WebSocket) для streaming AI-ассистента

**Дата**: 2026-07-25 · **Статус**: Accepted · **Фаза**: Python→Next.js порт

## Контекст

AI-ассистент Gidede (Блок 7) показывает ответ LLM «слово за словом» по мере генерации. Нужно было выбрать транспорт между сервером и клиентским компонентом блока 7 (`src/app/blocks/7/page.tsx`). Варианты:

1. **WebSocket** — двунаправленный, persistent-коннект, требует connection-upgrade, отдельного сервера (или `ws`-интеграции с Next.js), своего протокола heartbeat/reconnect.
2. **SSE (Server-Sent Events)** — однонаправленный server→client поверх HTTP, нативно поддерживается браузерами через `EventSource` (или `fetch`+`ReadableStream`), работает через любые HTTP-прокси без upgrade.
3. **HTTP long-polling** — устаревший fallback, сложнее в реализации.
4. **Chunked HTTP response** — вариант SSE без формата `event:`; менее стандартизирован.

Поток данных строго однонаправленный: клиент один раз отправляет вопрос (`POST`), сервер стримит токены обратно. Клиенту не нужно слать промежуточные сообщения в рамках одного ответа — есть отдельный `/assistant/chat` (non-streaming) и `/assistant/suggestions` для других задач.

## Решение

Использовать **SSE через `ReadableStream` + `text/event-stream`** (`src/app/api/v1/assistant/chat/stream/route.ts`):

```ts
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    const send = (obj: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

    send({ type: "start", message_id: assistantMsgId });
    const fullText = await streamAiResponse(ctx, (delta) => {
      accumulated += delta;
      send({ type: "message", content: accumulated }); // full-so-far
    });
    send({ type: "done", message_id: assistantMsgId, model_used, provider, latency_ms });
    controller.close();
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // критично для Nginx — отключает буферизацию
  },
});
```

`streamAiResponse()` (`src/lib/ai-service.ts`) использует `zai.chat.completions.create({ messages, stream: true, thinking: { type: "disabled" } })` и вызывает `onDelta(chunk)` для каждого токена. События: `start` (message_id) → многократно `message` (полный накопленный текст) → финальный `done` (метаданные модели/latency). Фронтенд читает `event.type === "message"` и заменяет контент целиком, затем финализирует по `done`.

## Последствия

**Положительные:**
- **Проще WebSocket**: один HTTP-запрос, нет handshake-upgrade, нет протокола ping/pong, нет state-управления коннектами на сервере.
- **Работает через прокси**: Nginx/Caddy/CDN проксируют SSE как обычный chunked-HTTP (заголовок `X-Accel-Buffering: no` явно отключает буферизацию в Nginx, иначе токены придут одним чанком в конце).
- **Авто-reconnect**: браузерный `EventSource` сам переподключается при обрыве (здесь используется `fetch`-based стриминг, но семантика та же).
- **Совместимость с Next.js 16**: `Response(stream)` из Web Streams API — нативный паттерн Next.js App Router для SSE, без сторонних либ.
- **Graceful fallback**: если `streamAiResponse` вернёт `null` (SDK недоступен), стрим шлёт событие `done` с детерминированным fallback-сообщением — клиент не «зависает».

**Отрицательные:**
- Однонаправленность: если позже понадобится интерактивный чат с interrupt/cancel-токенами со стороны клиента — придётся либо добавлять второй канал (отдельный `POST` для cancel), либо мигрировать на WebSocket. Для текущего UX (один вопрос → один стрим ответа) избыточно.
- `ReadableStream` в Next.js требует careful handling в edge-runtime (текущая имплементация работает в Node.js runtime).
- Браузерный лимит ~6 одновременных SSE-коннектов на домен — неактуально (один чат за раз).

## Альтернативы рассмотренные

- **WebSocket**: отвергнут из-за избыточной сложности для однонаправленного потока и проблем интеграции с Next.js API Routes (нужен custom server или `socket.io`).
- **Vercel AI SDK (`useChat`)**: добавил бы зависимость и абстракцию поверх того, что уже реализовано вручную в ~220 строк.

## Связанные файлы

- `src/app/api/v1/assistant/chat/stream/route.ts` — SSE-эндпоинт.
- `src/lib/ai-service.ts` — `streamAiResponse()` (обёртка над `zai.chat.completions.create({ stream: true })`).
- `src/app/blocks/7/page.tsx` — клиентский consumer (читает `Authorization: Bearer` из localStorage для SSE).
- `docs/DEPLOYMENT.md` — заметки о `proxy_buffering off` для Nginx.
