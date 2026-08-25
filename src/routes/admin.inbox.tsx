import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSessions,
  getSessionMessages,
  assignSession,
  updateSessionStatus,
} from "@/lib/inbox.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import {
  Inbox,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  User,
  Bot,
  Send,
  Loader2,
  ArrowLeft,
  Clock,
  Hash,
  CheckCircle2,
  AlertTriangle,
  Archive,
  CircleDot,
  Filter,
  UserCheck,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/admin/inbox")({
  component: InboxPage,
});

type SessionRow = {
  id: string;
  external_id: string | null;
  channel: string | null;
  customer_name: string | null;
  status: string | null;
  assigned_agent: string | null;
  message_count: number | null;
  started_at: string | null;
  last_message_at: string | null;
};

type SessionMessage = {
  id: string;
  role: string;
  content: string;
  channel: string | null;
  created_at: string | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "সব", icon: Filter },
  { value: "active", label: "সক্রিয়", icon: CircleDot },
  { value: "resolved", label: "সমাধান", icon: CheckCircle2 },
  { value: "escalated", label: "এস্কালেটেড", icon: AlertTriangle },
  { value: "archived", label: "আর্কাইভ", icon: Archive },
] as const;

const CHANNEL_OPTIONS = [
  { value: "messenger", label: "Messenger" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "web", label: "ওয়েব" },
  { value: "sms", label: "SMS" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "border-success text-success",
  resolved: "border-primary text-primary",
  escalated: "border-warning text-warning",
  archived: "border-muted-foreground text-muted-foreground",
};

const CHANNEL_COLORS: Record<string, string> = {
  messenger: "border-blue-400 text-blue-400",
  whatsapp: "border-green-400 text-green-400",
  instagram: "border-pink-400 text-pink-400",
  web: "border-purple-400 text-purple-400",
  sms: "border-orange-400 text-orange-400",
};

const PAGE_SIZE = 25;

function InboxPage() {
  const qc = useQueryClient();
  const fetchSessions = useServerFn(listSessions);
  const fetchMessages = useServerFn(getSessionMessages);
  const doAssign = useServerFn(assignSession);
  const doUpdateStatus = useServerFn(updateSessionStatus);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  // Selection
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);

  // Agent assignment
  const [agentInput, setAgentInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["inbox-sessions", statusFilter, channelFilter, searchQuery, page],
    queryFn: () =>
      fetchSessions({
        data: {
          status: statusFilter as any,
          channel: channelFilter || undefined,
          search: searchQuery || undefined,
          page,
        },
      }),
  });

  // Fetch messages for selected session
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["inbox-messages", selectedSessionId],
    queryFn: () => fetchMessages({ data: { sessionId: selectedSessionId! } }),
    enabled: Boolean(selectedSessionId),
  });

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages]);

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (data: { sessionId: string; agent: string }) =>
      doAssign({ data }),
    onSuccess: () => {
      toast.success("এজেন্ট নিয়োগ হয়েছে");
      qc.invalidateQueries({ queryKey: ["inbox-sessions"] });
      setAgentInput("");
    },
    onError: (err: any) => toast.error(err.message || "নিয়োগ ব্যর্থ"),
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: (data: { sessionId: string; status: string }) =>
      doUpdateStatus({ data: { sessionId: data.sessionId, status: data.status as any } }),
    onSuccess: () => {
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["inbox-sessions"] });
    },
    onError: (err: any) => toast.error(err.message || "আপডেট ব্যর্থ"),
  });

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(0);
  };

  const handleSelectSession = (session: SessionRow) => {
    setSelectedSessionId(session.id);
    setAgentInput(session.assigned_agent || "");
    setShowMessages(true);
  };

  const handleBackToList = () => {
    setShowMessages(false);
    setTimeout(() => setSelectedSessionId(null), 200);
  };

  const selectedSession = sessionsData?.rows?.find(
    (s: SessionRow) => s.id === selectedSessionId
  );

  const totalPages = sessionsData ? Math.ceil(sessionsData.total / PAGE_SIZE) : 0;

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Inbox className="size-8 text-primary" /> ইনবক্স (Omnichannel Inbox)
        </h1>
        <p className="mt-2 text-muted-foreground">
          সকল চ্যানেলের কনভার্সেশন দেখুন এবং ম্যানেজ করুন।
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="flex h-[calc(100vh-220px)] min-h-[500px] rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md overflow-hidden">
        {/* Left Panel - Session List */}
        <div
          className={cn(
            "flex flex-col border-r border-border/30 transition-all duration-300",
            showMessages ? "w-0 md:w-[380px] lg:w-[420px] overflow-hidden" : "w-full md:w-[420px] lg:w-[480px]",
            !showMessages && "md:block",
            showMessages ? "max-md:hidden" : "max-md:hidden md:block"
          )}
        >
          {/* Filters */}
          <div className="shrink-0 border-b border-border/30 p-4 space-y-3">
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={statusFilter === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setPage(0);
                  }}
                  className={cn(
                    "text-[10px] uppercase font-black h-7 px-2.5",
                    statusFilter === opt.value && "shadow-md shadow-primary/20"
                  )}
                >
                  <opt.icon className="size-3 mr-1" />
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Channel + Search row */}
            <div className="flex gap-2">
              <select
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setPage(0);
                }}
                className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                <option value="">সব চ্যানেল</option>
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="খুঁজুন..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Session list */}
          <ScrollArea className="flex-1">
            {sessionsLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : sessionsData?.rows?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Inbox className="size-12 text-muted-foreground opacity-20 mb-4" />
                <p className="text-sm text-muted-foreground">কোন কনভার্সেশন পাওয়া যায়নি।</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {sessionsData?.rows.map((session: SessionRow) => {
                  const isSelected = session.id === selectedSessionId;
                  const displayName =
                    session.customer_name || session.external_id || "অজ্ঞাত ব্যবহারকারী";
                  return (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={cn(
                        "w-full text-left p-4 transition-all duration-150 hover:bg-primary/5",
                        isSelected && "bg-primary/10 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold truncate">{displayName}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[8px] uppercase font-black shrink-0 px-1.5 py-0",
                                session.channel ? CHANNEL_COLORS[session.channel] || "border-muted-foreground text-muted-foreground" : "border-muted-foreground text-muted-foreground"
                              )}
                            >
                              {session.channel || "unknown"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[8px] uppercase font-black px-1.5 py-0",
                                session.status ? STATUS_COLORS[session.status] || "border-muted-foreground text-muted-foreground" : "border-muted-foreground text-muted-foreground"
                              )}
                            >
                              {session.status || "unknown"}
                            </Badge>
                            {session.assigned_agent && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <UserCheck className="size-2.5" />
                                {session.assigned_agent}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {session.last_message_at
                              ? new Date(session.last_message_at).toLocaleTimeString("bn-BD", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <MessageSquare className="size-2.5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {session.message_count || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {sessionsData && sessionsData.total > PAGE_SIZE && (
            <div className="shrink-0 flex items-center justify-between border-t border-border/30 px-4 py-2.5">
              <p className="text-[10px] text-muted-foreground">
                মোট {sessionsData.total} টি
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-[10px] font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= sessionsData.total}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Messages & Details */}
        <div
          className={cn(
            "flex flex-1 min-w-0 transition-all duration-300",
            !showMessages ? "max-md:hidden" : "max-md:w-full"
          )}
        >
          {!selectedSessionId ? (
            /* Empty state */
            <div className="hidden md:flex flex-col items-center justify-center flex-1 text-center px-8">
              <div className="relative mb-6">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl opacity-30" />
                <div className="relative size-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Inbox className="size-10 text-primary/50" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">ইনবক্স</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                একটি কনভার্সেশন নির্বাচন করুন এবং মেসেজ দেখুন।
              </p>
            </div>
          ) : (
            <>
              {/* Mobile back button */}
              <div className="md:hidden shrink-0 p-2 border-r border-border/30">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToList}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="size-5" />
                </Button>
              </div>

              {/* Messages thread */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* Messages header */}
                {selectedSession && (
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <User className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">
                          {selectedSession.customer_name || selectedSession.external_id || "অজ্ঞাত"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedSession.channel} &middot;{" "}
                          {selectedSession.message_count || 0} মেসেজ
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] uppercase font-black shrink-0",
                        selectedSession.status ? STATUS_COLORS[selectedSession.status] || "border-muted-foreground text-muted-foreground" : "border-muted-foreground text-muted-foreground"
                      )}
                    >
                      {selectedSession.status || "unknown"}
                    </Badge>
                  </div>
                )}

                {/* Message list */}
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                  ) : !messages?.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="size-8 text-muted-foreground opacity-20 mb-3" />
                      <p className="text-sm text-muted-foreground">কোন মেসেজ নেই।</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg: SessionMessage) => {
                        const isUser = msg.role === "user";
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              isUser ? "justify-start" : "justify-end"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3",
                                isUser
                                  ? "bg-white/5 border border-white/10 rounded-bl-sm"
                                  : "bg-primary/10 border border-primary/20 rounded-br-sm"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {isUser ? (
                                  <User className="size-3 text-muted-foreground" />
                                ) : (
                                  <Bot className="size-3 text-primary" />
                                )}
                                <span className="text-[9px] uppercase font-bold text-muted-foreground">
                                  {isUser ? "ব্যবহারকারী" : "এআই"}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                              <p className="text-[9px] text-muted-foreground mt-2 text-right">
                                {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("bn-BD", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }) : "N/A"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Details sidebar */}
              {selectedSession && (
                <div className="hidden lg:flex flex-col w-72 border-l border-border/30 bg-muted/10">
                  <div className="p-4 border-b border-border/30">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ArrowUpRight className="size-4 text-primary" /> সেশন বিস্তারিত
                    </h3>
                  </div>
                  <ScrollArea className="flex-1 p-4 space-y-5">
                    {/* Customer info */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                        ব্যবহারকারী
                      </label>
                      <div className="panel p-3 border-white/5 bg-white/5 backdrop-blur-sm">
                        <p className="text-sm font-bold">
                          {selectedSession.customer_name || "নাম নেই"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {selectedSession.external_id}
                        </p>
                      </div>
                    </div>

                    {/* Session info */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                        তথ্য
                      </label>
                      <div className="panel p-3 border-white/5 bg-white/5 backdrop-blur-sm space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Hash className="size-3" /> চ্যানেল
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[8px] uppercase font-black px-1.5 py-0",
                              selectedSession.channel ? CHANNEL_COLORS[selectedSession.channel] || "" : ""
                            )}
                          >
                            {selectedSession.channel || "unknown"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <MessageSquare className="size-3" /> মেসেজ
                          </span>
                          <span className="font-bold">{selectedSession.message_count || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Clock className="size-3" /> শুরু
                          </span>
                          <span className="font-bold">
                            {selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleDateString("bn-BD") : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Assign agent */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                        এজেন্ট নিয়োগ
                      </label>
                      <div className="panel p-3 border-white/5 bg-white/5 backdrop-blur-sm">
                        <div className="flex gap-2">
                          <Input
                            placeholder="এজেন্ট নাম"
                            value={agentInput}
                            onChange={(e) => setAgentInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && agentInput.trim()) {
                                assignMutation.mutate({
                                  sessionId: selectedSession.id,
                                  agent: agentInput.trim(),
                                });
                              }
                            }}
                            className="h-8 text-xs"
                          />
                          <Button
                            size="sm"
                            disabled={!agentInput.trim() || assignMutation.isPending}
                            onClick={() => {
                              if (agentInput.trim()) {
                                assignMutation.mutate({
                                  sessionId: selectedSession.id,
                                  agent: agentInput.trim(),
                                });
                              }
                            }}
                            className="h-8 px-3 shrink-0"
                          >
                            {assignMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <UserCheck className="size-3" />
                            )}
                          </Button>
                        </div>
                        {selectedSession.assigned_agent && (
                          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                            বর্তমান:
                            <span className="text-primary font-bold">
                              {selectedSession.assigned_agent}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Change status */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                        স্ট্যাটাস পরিবর্তন
                      </label>
                      <div className="panel p-3 border-white/5 bg-white/5 backdrop-blur-sm grid grid-cols-2 gap-2">
                        {(["active", "resolved", "escalated", "archived"] as const).map(
                          (status) => (
                            <Button
                              key={status}
                              variant={selectedSession.status === status ? "default" : "outline"}
                              size="sm"
                              disabled={
                                statusMutation.isPending ||
                                selectedSession.status === status
                              }
                              onClick={() =>
                                statusMutation.mutate({
                                  sessionId: selectedSession.id,
                                  status,
                                })
                              }
                              className={cn(
                                "h-8 text-[10px] uppercase font-black",
                                selectedSession.status === status && "shadow-md"
                              )}
                            >
                              {status === "active" && <CircleDot className="size-3 mr-1" />}
                              {status === "resolved" && <CheckCircle2 className="size-3 mr-1" />}
                              {status === "escalated" && <AlertTriangle className="size-3 mr-1" />}
                              {status === "archived" && <Archive className="size-3 mr-1" />}
                              {status === "active"
                                ? "সক্রিয়"
                                : status === "resolved"
                                ? "সমাধান"
                                : status === "escalated"
                                ? "এস্কালেট"
                                : "আর্কাইভ"}
                            </Button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Session ID */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                        সেশন আইডি
                      </label>
                      <div className="panel p-3 border-white/5 bg-white/5 backdrop-blur-sm">
                        <p className="text-[10px] font-mono text-muted-foreground break-all">
                          {selectedSession.id}
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
