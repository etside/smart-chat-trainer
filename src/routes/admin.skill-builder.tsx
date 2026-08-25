import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateCustomerQuestions,
  getTrainingPairsForGeneration,
  saveSkill,
  testQuestions,
} from "@/lib/skill-builder.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronRight,
  Loader2,
  MessageSquare,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/skill-builder")({
  component: SkillBuilderPage,
});

type GeneratedQuestion = { question: string; angle: string };
type TestedResult = {
  question: string;
  reply: string;
  editedReply: string;
  sources: Array<{ question: string; answer: string }>;
  saved: boolean;
};

function SkillBuilderPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<TestedResult[]>([]);

  const fetchPairs = useServerFn(getTrainingPairsForGeneration);
  const generateQuestions = useServerFn(generateCustomerQuestions);
  const runTest = useServerFn(testQuestions);
  const saveSkillFn = useServerFn(saveSkill);

  const pairsQuery = useQuery({
    queryKey: ["skill-builder-pairs"],
    queryFn: () => fetchPairs(),
  });

  const generateMutation = useMutation({
    mutationFn: (pairIds: string[]) => generateQuestions({ data: { pairIds } }),
    onSuccess: (data) => {
      if (!data.questions || data.questions.length === 0) {
        toast.error("কোনো প্রশ্ন তৈরি হয়নি। আবার চেষ্টা করুন।");
        return;
      }
      setStep(2);
      runTestMutation.mutate(data.questions.map((q) => q.question));
    },
    onError: () => toast.error("প্রশ্ন তৈরি করা যায়নি"),
  });

  const runTestMutation = useMutation({
    mutationFn: (questions: string[]) => runTest({ data: { questions } }),
    onSuccess: (data) => {
      setResults(
        data.results.map((r) => ({
          ...r,
          editedReply: r.reply,
          saved: false,
        })),
      );
    },
    onError: () => toast.error("AI রেসপন্স টেস্ট করা যায়নি"),
  });

  const saveMutation = useMutation({
    mutationFn: (item: { question: string; answer: string }) =>
      saveSkill({ data: { question: item.question, answer: item.answer } }),
    onSuccess: (_, variables) => {
      setResults((prev) =>
        prev.map((r) =>
          r.question === variables.question ? { ...r, saved: true } : r,
        ),
      );
      toast.success("স্কিল সেভ হয়েছে!");
    },
    onError: () => toast.error("সেভ করা যায়নি"),
  });

  const handleTogglePair = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (!pairsQuery.data) return;
    setSelectedIds(
      selectedIds.length === pairsQuery.data.length
        ? []
        : pairsQuery.data.map((p: any) => p.id),
    );
  };

  const handleGenerate = () => {
    if (selectedIds.length === 0) {
      toast.error("অন্তত একটি ট্রেনিং ডেটা সিলেক্ট করুন");
      return;
    }
    generateMutation.mutate(selectedIds);
  };

  const handleEditReply = (index: number, value: string) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, editedReply: value } : r)),
    );
  };

  const handleSaveOne = (index: number) => {
    const item = results[index];
    if (!item?.editedReply.trim()) {
      toast.error("রেসপন্স খালি রাখা যায়নি");
      return;
    }
    saveMutation.mutate({
      question: item.question,
      answer: item.editedReply,
    });
  };

  const handleSaveAll = () => {
    const unsaved = results.filter((r) => !r.saved && r.editedReply.trim());
    if (unsaved.length === 0) {
      toast.error("সব ইতিমধ্যে সেভ হয়েছে");
      return;
    }
    for (const item of unsaved) {
      saveMutation.mutate({
        question: item.question,
        answer: item.editedReply,
      });
    }
  };

  const savedCount = results.filter((r) => r.saved).length;

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wand2 className="size-8 text-primary" /> স্কিল বিল্ডার
        </h1>
        <p className="mt-2 text-muted-foreground">
          ট্রেনিং ডেটা থেকে কাস্টমার প্রশ্ন তৈরি করুন, AI রেসপন্স পরীক্ষা করুন,
          এবং উন্নত উত্তর স্কিল হিসেবে সেভ করুন।
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: "ডেটা সিলেক্ট" },
          { n: 2, label: "জেনারেট ও এডিট" },
          { n: 3, label: "সেভ স্কিল" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s.n
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.n ? <Check className="size-4" /> : s.n}
            </div>
            <span
              className={`text-sm font-medium ${
                step === s.n ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < 2 && (
              <ChevronRight className="size-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Training Pairs */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pairsQuery.data
                ? `${pairsQuery.data.length} টি অ্যাপ্রুভড ট্রেনিং পেয়ার পাওয়া গেছে`
                : "লোড হচ্ছে..."}
            </p>
            {pairsQuery.data && pairsQuery.data.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedIds.length === pairsQuery.data.length
                  ? "সিলেক্শন মুছুন"
                  : "সব সিলেক্ট করুন"}
              </Button>
            )}
          </div>

          <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {pairsQuery.data?.map((pair: any) => (
              <label
                key={pair.id}
                className={`panel panel-hover flex items-start gap-3 p-4 cursor-pointer border-l-4 transition-colors ${
                  selectedIds.includes(pair.id)
                    ? "border-l-primary bg-primary/5"
                    : "border-l-transparent"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(pair.id)}
                  onChange={() => handleTogglePair(pair.id)}
                  className="mt-1 size-4 rounded border-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{pair.question}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {pair.answer}
                  </p>
                </div>
                <span className="text-[10px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground shrink-0">
                  {pair.source}
                </span>
              </label>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={selectedIds.length === 0 || generateMutation.isPending}
            className="w-full"
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                প্রশ্ন তৈরি হচ্ছে...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                {selectedIds.length} টি ডেটা থেকে প্রশ্ন জেনারেট করুন
              </>
            )}
          </Button>
        </div>
      )}

      {/* Step 2: Generated Questions + AI Responses + Edit */}
      {step === 2 && (
        <div className="space-y-4">
          {runTestMutation.isPending && results.length === 0 && (
            <div className="panel p-10 text-center">
              <Loader2 className="size-8 mx-auto animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">
                AI প্রতিটি প্রশ্নের উত্তর তৈরি করছে...
              </p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {results.length} টি প্রশ্ন জেনারেট হয়েছে
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStep(1);
                      setResults([]);
                    }}
                  >
                    আবার শুরু করুন
                  </Button>
                  <Button size="sm" onClick={handleSaveAll} disabled={savedCount === results.length}>
                    <Check className="size-3.5 mr-1" />
                    সব সেভ ({savedCount}/{results.length})
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`panel p-5 border-l-4 transition-colors ${
                      r.saved
                        ? "border-l-green-500 bg-green-500/5"
                        : "border-l-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-[10px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {r.saved ? "সেভ হয়েছে" : "এডিট করুন"}
                        </span>
                      </div>
                      {!r.saved && (
                        <Button
                          size="sm"
                          onClick={() => handleSaveOne(i)}
                          disabled={saveMutation.isPending}
                        >
                          <Check className="size-3.5 mr-1" /> সেভ
                        </Button>
                      )}
                      {r.saved && (
                        <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                          <Check className="size-3.5" /> সেভড
                        </span>
                      )}
                    </div>

                    {/* Customer Question */}
                    <div className="mb-3">
                      <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">
                        কাস্টমার প্রশ্ন
                      </p>
                      <p className="text-sm font-medium bg-muted/50 rounded-lg px-3 py-2">
                        {r.question}
                      </p>
                    </div>

                    {/* AI Original Reply */}
                    <div className="mb-3">
                      <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">
                        AI রেসপন্স (অরিজিনাল)
                      </p>
                      <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                        {r.reply}
                      </p>
                    </div>

                    {/* Editable Reply */}
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">
                        উন্নত উত্তর (এডিট করুন)
                      </p>
                      <Textarea
                        value={r.editedReply}
                        onChange={(e) => handleEditReply(i, e.target.value)}
                        rows={3}
                        className="text-sm"
                        disabled={r.saved}
                      />
                    </div>

                    {/* RAG Sources */}
                    {r.sources.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-[10px] uppercase font-black text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          RAG Sources ({r.sources.length})
                        </summary>
                        <div className="mt-2 space-y-1">
                          {r.sources.map((s, j) => (
                            <div
                              key={j}
                              className="text-xs bg-muted/30 rounded px-2 py-1"
                            >
                              <span className="font-medium">{s.question}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                → {s.answer.slice(0, 80)}...
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
