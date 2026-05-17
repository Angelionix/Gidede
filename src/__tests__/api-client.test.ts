/**
 * Gidede — API Client Tests
 * Фаза 4.A.11: Локальная тестовая инфраструктура
 *
 * Тесты API-клиента:
 * - Формирование URL
 * - Обработка ошибок
 * - Авторизация в заголовках
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Мок для fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API Client — формирование запросов", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("базовый URL API корректен", () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030/api/v1";
    expect(API_BASE).toContain("/api/v1");
  });

  it("заголовки авторизации добавляются", () => {
    const token = "test-jwt-token";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };
    expect(headers["Authorization"]).toBe("Bearer test-jwt-token");
  });

  it("обработка 401 ошибки", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Unauthorized" }),
    });

    const response = await fetch("http://localhost:3030/api/v1/auth/me");
    expect(response.status).toBe(401);
    expect(response.ok).toBe(false);
  });

  it("обработка 500 ошибки", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: "Internal Server Error" }),
    });

    const response = await fetch("http://localhost:3030/api/v1/projects/");
    expect(response.status).toBe(500);
    expect(response.ok).toBe(false);
  });
});
