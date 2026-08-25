import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAnalyticsSummary,
  getConversationVolume,
  getChannelDistribution,
} from "@/lib/inbox.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  MessageSquare,
  MessagesSquare,
  TrendingUp,
  Target,
  Activity,
  RefreshCcw,
  Hash,
  Clock,
  Users,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsDashboard,
});

const TIME_RANGES = [
  { label: "৭ দিন", value: 7 },
  { label: "১৪ দিন", value: 14 },
  { label: "৩০ দিন", value: 30 },
  { label: "৯০ দিন", value: 90 },
] as const;

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-500",
  facebook: "bg-[#1877F2]",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  messenger: "bg-blue-500",
  telegram: "bg-sky-500",
  web: "bg-primary",
};

function getChannelColor(channel: string | null): string {
  if (!channel) return "bg-muted-foreground";
  const lower = channel.toLowerCase();
  for (const [key, color] of Object.entries(CHANNEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "bg-muted-foreground";
}

function AnalyticsDashboard() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);

  const fetchSummary = useServerFn(getAnalyticsSummary);
  const fetchVolume = useServerFn(getConversationVolume);
  const fetchChannels = useServerFn(getChannelDistribution);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", days],
    queryFn: () => fetchSummary({ data: { days } }),
  });

  const { data: volume, isLoading: volumeLoading } = useQuery({
    queryKey: ["analytics-volume", days],
    queryFn: () => fetchVolume({ data: { days } }),
  });

  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ["analytics-channels", days],
    queryFn: () => fetchChannels({ data: { days } }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
    queryClient.invalidateQueries({ queryKey: ["analytics-volume"] });
    queryClient.invalidateQueries({ queryKey: ["analytics-channels"] });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="size-8 text-primary" /> অ্যানালিটিক্স ড্যাশবোর্ড
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            কথোপকথন পরিসংখ্যান, চ্যানেল বিতরণ এবং ট্রেন্ড বিশ্লেষণ।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCcw className="mr-2 size-3" /> রিফ্রেশ
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">
          সময়কাল
        </span>
        <div className="flex gap-1 bg-muted/20 p-1 rounded-lg border border-white/5">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={days === range.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setDays(range.value)}
              className={cn(
                "h-8 px-4 text-xs font-bold",
                days === range.value
                  ? "shadow-md shadow-black/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <SummaryCard
          label="মোট কথোপকথন"
          labelEn="Total Conversations"
          value={summary?.total_conversations}
          icon={<MessagesSquare className="size-4" />}
          color="primary"
          loading={summaryLoading}
        />
        <SummaryCard
          label="মোট মেসেজ"
          labelEn="Total Messages"
          value={summary?.total_messages}
          icon={<MessageSquare className="size-4" />}
          color="accent"
          loading={summaryLoading}
        />
        <SummaryCard
          label="গড় মেসেজ/কথোপকথন"
          labelEn="Avg Messages per Conv"
          value={summary?.avg_messages_per_conversation}
          icon={<TrendingUp className="size-4" />}
          color="success"
          loading={summaryLoading}
          decimals={1}
        />
        <SummaryCard
          label="রেসপন্স নির্ভুলতা"
          labelEn="Response Accuracy"
          value={summary?.response_accuracy}
          icon={<Target className="size-4" />}
          color="info"
          loading={summaryLoading}
          suffix="%"
          decimals={1}
        />
      </div>

      {/* Middle Row: Channel Distribution + Top Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Channel Distribution */}
        <div className="lg:col-span-5 panel p-6 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Users className="size-5 text-primary" />
            <h2 className="font-bold">চ্যানেল বিতরণ</h2>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-auto">
              Channel Split
            </span>
          </div>

          {channelsLoading ? (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          ) : !channels || channels.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              কোনো ডেটা পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-5">
              {(() => {
                const totalCount = channels.reduce((sum, c) => sum + c.count, 0);
                return channels
                  .sort((a, b) => b.count - a.count)
                  .map((ch) => {
                    const pct = totalCount > 0 ? (ch.count / totalCount) * 100 : 0;
                    return (
                      <div key={ch.channel} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold capitalize">{ch.channel}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {ch.count.toLocaleString("bn-BD")}{" "}
                            <span className="text-[10px]">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-muted/30 overflow-hidden border border-white/5">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700 ease-out",
                              getChannelColor(ch.channel)
                            )}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          )}
        </div>

        {/* Top Questions */}
        <div className="lg:col-span-7 panel overflow-hidden bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
          <div className="p-6 border-b border-white/5 flex items-center gap-2">
            <Hash className="size-5 text-primary" />
            <h2 className="font-bold">শীর্ষ প্রশ্নসমূহ</h2>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-auto">
              Top Questions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-6 py-3 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                    #
                  </th>
                  <th className="px-6 py-3 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                    প্রশ্ন
                  </th>
                  <th className="px-6 py-3 font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-right">
                    ব্যবহার
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {summaryLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <Skeleton className="h-3 w-4" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-3 w-48" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton className="h-3 w-8 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : !summary?.top_questions || summary.top_questions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-12 text-center text-sm text-muted-foreground"
                    >
                      কোনো প্রশ্ন পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  summary.top_questions.map(
                    (q: { question: string; count: number }, idx: number) => (
                      <tr
                        key={idx}
                        className="hover:bg-primary/5 transition-colors"
                      >
                        <td className="px-6 py-4 text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4 font-medium max-w-sm truncate">
                          {q.question}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-black tracking-tighter bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 tabular-nums">
                            {q.count}
                          </span>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Conversation Volume Over Time */}
      <div className="panel p-6 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="size-5 text-primary" />
          <h2 className="font-bold">কথোপকথন ভলিউম (দিন অনুযায়ী)</h2>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-auto">
            Volume Over Time
          </span>
        </div>

        {volumeLoading ? (
          <div className="flex items-end gap-1 h-48">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t"
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
        ) : !volume || volume.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            কোনো ভলিউম ডেটা পাওয়া যায়নি।
          </div>
        ) : (
          (() => {
            const maxCount = Math.max(...volume.map((v) => v.total), 1);
            return (
              <div>
                {/* Bar Chart */}
                <div className="flex items-end gap-1 h-48">
                  {volume.map((day) => {
                    const height = (day.total / maxCount) * 100;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 min-w-0 group relative"
                      >
                        <div
                          className="w-full rounded-t transition-all duration-300 bg-primary/60 hover:bg-primary/80"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-popover text-popover-foreground text-[10px] font-bold rounded-lg px-3 py-2 shadow-xl border border-white/10 whitespace-nowrap">
                            <div className="font-black">{day.total} টি</div>
                            <div className="text-muted-foreground font-normal mt-0.5">
                              {day.date}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Date Labels */}
                <div className="flex gap-1 mt-2">
                  {volume.map((day) => (
                    <div
                      key={day.date}
                      className="flex-1 min-w-0 text-center text-[8px] text-muted-foreground truncate"
                      title={day.date}
                    >
                      {volume.length <= 30 ? day.date.slice(5) : ""}
                    </div>
                  ))}
                </div>

                {/* Summary Footer */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-muted-foreground">
                  <span>
                    মোট দিন:{" "}
                    <span className="font-bold text-foreground tabular-nums">
                      {volume.length}
                    </span>
                  </span>
                  <span>
                    সর্বোচ্চ:{" "}
                    <span className="font-bold text-primary tabular-nums">
                      {maxCount}
                    </span>{" "}
                    / দিন
                  </span>
                  <span>
                    গড়:{" "}
                    <span className="font-bold text-foreground tabular-nums">
                      {(
                        volume.reduce((sum, v) => sum + v.total, 0) / volume.length
                      ).toFixed(1)}
                    </span>{" "}
                    / দিন
                  </span>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card Sub-component                                         */
/* ------------------------------------------------------------------ */

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  primary: {
    bg: "bg-primary/5",
    border: "border-primary/20",
    text: "text-primary",
    shadow: "shadow-primary/5",
  },
  accent: {
    bg: "bg-accent/5",
    border: "border-accent/20",
    text: "text-accent",
    shadow: "shadow-accent/5",
  },
  success: {
    bg: "bg-green-500/5",
    border: "border-green-500/20",
    text: "text-green-500",
    shadow: "shadow-green-500/5",
  },
  info: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/20",
    text: "text-blue-500",
    shadow: "shadow-blue-500/5",
  },
};

function SummaryCard({
  label,
  labelEn,
  value,
  icon,
  color,
  loading,
  suffix = "",
  decimals = 0,
}: {
  label: string;
  labelEn: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
  suffix?: string;
  decimals?: number;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP['primary']!;

  return (
    <div
      className={cn(
        "panel p-6 relative overflow-hidden group shadow-2xl transition-all",
        c.bg,
        c.border,
        c.shadow
      )}
    >
      <div className="relative z-10">
        <div className={cn("flex items-center gap-2 mb-3", c.text)}>
          {icon}
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
            {labelEn}
          </span>
        </div>
        {loading ? (
          <Skeleton className="h-10 w-24 rounded" />
        ) : (
          <h3 className="text-3xl md:text-4xl font-black tracking-tighter tabular-nums">
            {value !== undefined ? (
              <>
                {typeof value === "number"
                  ? value.toLocaleString("en-US", {
                      minimumFractionDigits: decimals,
                      maximumFractionDigits: decimals,
                    })
                  : value}
                {suffix && (
                  <span className="text-xl ml-1 text-muted-foreground">{suffix}</span>
                )}
              </>
            ) : (
              "—"
            )}
          </h3>
        )}
        <p className="mt-3 text-xs font-bold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
