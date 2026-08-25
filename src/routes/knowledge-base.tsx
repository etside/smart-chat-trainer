import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as React from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  HelpCircle,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { getFaqs } from "@/lib/console.functions";

/* -------------------------------------------------------------------------- */
/*  Server functions                                                          */
/* -------------------------------------------------------------------------- */

const searchKnowledgeBase = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: results } = await supabaseAdmin
      .from("training_pairs")
      .select("id, question, answer, labels, created_at")
      .eq("status", "approved")
      .or(`question.ilike.%${data.query}%,answer.ilike.%${data.query}%`)
      .limit(20);
    return results ?? [];
  });

/* -------------------------------------------------------------------------- */
/*  Route definition                                                          */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute("/knowledge-base")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — Daddy AI Help Center" },
      {
        name: "description",
        content:
          "Find answers to common questions about Daddy AI's voice-first sales training platform. Browse articles, search training pairs, and get the help you need.",
      },
      { property: "og:title", content: "Knowledge Base — Daddy AI Help Center" },
      {
        property: "og:description",
        content:
          "Find answers to common questions about Daddy AI's voice-first sales training platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KnowledgeBasePage,
});

/* -------------------------------------------------------------------------- */
/*  Language detection helpers                                                */
/* -------------------------------------------------------------------------- */

function t(
  en: string,
  bn: string,
  locale: "en" | "bn",
) {
  return locale === "bn" ? bn : en;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

interface TrainingPair {
  id?: string;
  question: string;
  answer: string;
  labels?: string[] | null;
  created_at?: string;
}

const CATEGORIES: { label: string; icon: React.ReactNode }[] = [
  { label: "Getting Started", icon: <Sparkles className="h-4 w-4" /> },
  { label: "Voice Training", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Integrations", icon: <ExternalLink className="h-4 w-4" /> },
  { label: "Pricing", icon: <HelpCircle className="h-4 w-4" /> },
  { label: "API & Developer", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Troubleshooting", icon: <MessageCircle className="h-4 w-4" /> },
];

const CONTACT_EMAIL = "support@daddyai.com";

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function SearchResultCard({
  pair,
  locale,
}: {
  pair: TrainingPair;
  locale: "en" | "bn";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="group border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 leading-snug">
            {pair.question}
          </h3>
          {pair.labels && pair.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Array.isArray(pair.labels) ? pair.labels : []).map(
                (label, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-[11px] font-medium bg-slate-100 text-slate-600 border-slate-200"
                  >
                    {label}
                  </Badge>
                ),
              )}
            </div>
          )}
        </div>
        <span className="mt-0.5 shrink-0 text-slate-400 transition-transform">
          {open ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          <Separator className="mb-4 bg-slate-100" />
          <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
            {pair.answer}
          </p>
        </div>
      )}
    </Card>
  );
}

function FaqCard({
  faq,
  locale,
}: {
  faq: { question: string; answer: string };
  locale: "en" | "bn";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left"
      >
        <h3 className="flex-1 text-base font-semibold text-slate-900 leading-snug">
          {faq.question}
        </h3>
        <span className="mt-0.5 shrink-0 text-slate-400 transition-transform">
          {open ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          <Separator className="mb-4 bg-slate-100" />
          <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
            {faq.answer}
          </p>
        </div>
      )}
    </Card>
  );
}

function CategoryCard({
  category,
  locale,
}: {
  category: { label: string; icon: React.ReactNode };
  locale: "en" | "bn";
}) {
  return (
    <button className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:border-blue-200 hover:shadow-md hover:bg-blue-50/30">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
        {category.icon}
      </span>
      <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
        {category.label}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                       */
/* -------------------------------------------------------------------------- */

function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [locale, setLocale] = useState<"en" | "bn">("en");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect language from browser on mount
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const lang = navigator.language || (navigator as any).userLanguage || "";
      if (lang.startsWith("bn")) {
        setLocale("bn");
      }
    }
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedQuery(value);
      }, 400);
    },
    [],
  );

  // Fetch featured FAQs (no auth required)
  const fetchFaqs = useServerFn(getFaqs);
  const { data: faqs = [] } = useQuery({
    queryKey: ["knowledge-base-faqs"],
    queryFn: () => fetchFaqs(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch search results when there is a query
  const fetchSearch = useServerFn(searchKnowledgeBase);
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ["knowledge-base-search", debouncedQuery],
    queryFn: () => fetchSearch({ data: { query: debouncedQuery } }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const showSearchResults = debouncedQuery.length >= 2;

  const featuredFaqs = useMemo(() => {
    const list = Array.isArray(faqs) ? faqs : [];
    return list.slice(0, 6);
  }, [faqs]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Nav bar ────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
          >
            <BookOpen className="h-5 w-5 text-blue-600" />
            <span>Daddy AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(locale === "en" ? "bn" : "en")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {locale === "en" ? "বাংলা" : "English"}
            </button>
            <Link
              to="/auth"
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t("Sign In", "লগইন", locale)}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t(
              "How can we help you?",
              "আমরা আপনাকে কীভাবে সাহায্য করতে পারি?",
              locale,
            )}
          </h1>
          <p className="mt-3 text-base text-slate-500 sm:text-lg">
            {t(
              "Search our knowledge base or browse popular articles below.",
              "আমাদের নলেজ বেস খুঁজুন অথবা নিচের জনপ্রিয় নিবন্ধগুলো দেখুন।",
              locale,
            )}
          </p>

          {/* Search bar */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t(
                  "Search for answers...",
                  "উত্তর খুঁজুন...",
                  locale,
                )}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {showSearchResults ? (
          /* ── Search results ─────────────────────────────────────── */
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {t("Search Results", "অনুসন্ধানের ফলাফল", locale)}
              </h2>
              {searchResults.length > 0 && (
                <span className="text-sm text-slate-500">
                  {searchResults.length}{" "}
                  {t("results found", "টি ফলাফল পাওয়া গেছে", locale)}
                </span>
              )}
            </div>

            {searchLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <Card className="border-slate-200 bg-white text-center">
                <CardContent className="py-12">
                  <Search className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 text-sm font-medium text-slate-500">
                    {t(
                      `No results found for "${debouncedQuery}"`,
                      `"${debouncedQuery}" - কোনো ফলাফল পাওয়া যায়নি`,
                      locale,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t(
                      "Try different keywords or browse categories below.",
                      "অন্য কীওয়ার্ড চেষ্টা করুন অথবা নিচের ক্যাটাগরি দেখুন।",
                      locale,
                    )}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {searchResults.map((pair, i) => (
                  <SearchResultCard
                    key={pair.id ?? i}
                    pair={pair}
                    locale={locale}
                  />
                ))}
              </div>
            )}

            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedQuery("");
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                {t("Clear search", "খোঁজ মুছুন", locale)}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Default view: categories + featured articles ──────── */
          <div className="space-y-12">
            {/* Categories */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {t("Browse by Category", "ক্যাটাগরি অনুযায়ী দেখুন", locale)}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {CATEGORIES.map((cat) => (
                  <CategoryCard key={cat.label} category={cat} locale={locale} />
                ))}
              </div>
            </section>

            {/* Featured / popular articles */}
            {featuredFaqs.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    {t(
                      "Popular Articles",
                      "জনপ্রিয় নিবন্ধ",
                      locale,
                    )}
                  </h2>
                </div>
                <div className="space-y-3">
                  {featuredFaqs.map((faq, i) => (
                    <FaqCard key={i} faq={faq} locale={locale} />
                  ))}
                </div>
              </section>
            )}

            {/* Quick links */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {t("Quick Links", "দ্রুত লিংক", locale)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  to="/faq"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <HelpCircle className="h-5 w-5 text-slate-400 group-hover:text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {t("FAQ", "সচরাচর জিজ্ঞাসা", locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(
                        "Quick answers to common questions",
                        "সাধারণ প্রশ্নের দ্রুত উত্তর",
                        locale,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </Link>
                <Link
                  to="/privacy"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <BookOpen className="h-5 w-5 text-slate-400 group-hover:text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {t("Privacy Policy", "গোপনীয়তা নীতি", locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(
                        "How we protect your data",
                        "আমরা আপনার তথ্য কীভাবে সুরক্ষা করি",
                        locale,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </Link>
                <Link
                  to="/terms"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <BookOpen className="h-5 w-5 text-slate-400 group-hover:text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {t("Terms of Service", "সেবার শর্তাবলী", locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(
                        "Our terms and conditions",
                        "আমাদের শর্তাবলী",
                        locale,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </Link>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <MessageCircle className="h-5 w-5 text-slate-400 group-hover:text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {t("Contact Support", "সাপোর্টে যোগাযোগ", locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(
                        "Get in touch with our team",
                        "আমাদের টিমের সাথে যোগাযোগ করুন",
                        locale,
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </a>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span>Daddy AI</span>
              <span className="text-slate-300">|</span>
              <span>
                {t("Knowledge Base", "নলেজ বেস", locale)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-1.5 transition-colors hover:text-blue-600"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("Contact Support", "সাপোর্টে যোগাযোগ", locale)}
              </a>
              <Link
                to="/faq"
                className="transition-colors hover:text-blue-600"
              >
                {t("FAQ", "সচরাচর জিজ্ঞাসা", locale)}
              </Link>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Daddy AI.{" "}
            {t("All rights reserved.", "সর্বস্বত্ব সংরক্ষিত।", locale)}
          </div>
        </div>
      </footer>
    </div>
  );
}
