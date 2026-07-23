"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, Loader2, Lightbulb, ExternalLink } from "lucide-react";

interface RagResult {
  title: string;
  snippet: string;
  source: string;
  section?: string;
  score: number;
  type?: "bible" | "curated";
}

interface RagResponse {
  results: RagResult[];
  total: number;
  stats: {
    bible_sections: number;
    bible_chunks: number;
    bible_terms: number;
  };
}

const SUGGESTED_QUERIES = [
  "MDA framework",
  "core loop",
  "balance transitive",
  "economy progression",
  "Schell lenses",
  "Triangle of Weirdness",
  "Machinations",
  "narrative design",
];

export default function KnowledgePage() {
  const { apiFetch, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RagResult[]>([]);
  const [stats, setStats] = useState<{ bible_sections: number; bible_chunks: number; bible_terms: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (q?: string) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) {
      toast({
        title: "Введите запрос",
        description: "Введите поисковый запрос для поиска по Библии геймдизайна",
        variant: "destructive",
      });
      return;
    }
    setQuery(searchQuery);
    setLoading(true);
    setSearched(true);
    try {
      const data = await apiFetch<RagResponse>("/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, top_k: 10 }),
      });
      setResults(data.results);
      setStats(data.stats);
    } catch (err) {
      toast({
        title: "Ошибка поиска",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground">База знаний доступна после авторизации.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">База знаний</h1>
          <p className="text-sm text-muted-foreground">
            Поиск по Библии геймдизайна (12 разделов) + кураторной базе концепций
          </p>
        </div>
      </div>

      {/* Stats card */}
      {stats && (
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{stats.bible_sections}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Разделов Библии</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{stats.bible_chunks}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Чанков индекса</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{stats.bible_terms.toLocaleString("ru-RU")}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Уникальных терминов</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Поиск по базе знаний
          </CardTitle>
          <CardDescription>
            TF-IDF поиск по 12 разделам Библии геймдизайна + 15 кураторным записям
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Например: core loop, MDA, balance..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={() => handleSearch()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Найти</span>
            </Button>
          </div>

          {/* Suggested queries */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="text-xs text-muted-foreground mr-1">Подсказки:</span>
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {loading ? "Поиск..." : `Найдено: ${results.length} результатов`}
            </h2>
          </div>

          {!loading && results.length === 0 && (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Ничего не найдено. Попробуйте другой запрос или подсказку выше.
                </p>
              </CardContent>
            </Card>
          )}

          {results.map((r, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm">{r.title}</h3>
                      {r.section && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {r.section}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          r.type === "bible"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900"
                        }`}
                      >
                        {r.type === "bible" ? "📖 Библия" : "⭐ Куратор"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {r.source}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">score</div>
                    <div className="text-lg font-bold text-primary">{r.score}</div>
                  </div>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{r.snippet}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
