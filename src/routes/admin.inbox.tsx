import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSessions,
  getSessionMessages,
  assignSession,
  updateSessionStatus,
  sendDraftReply,
  sendManualReply,
  sendVoiceReply,
} from "@/lib/inbox.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SparkleIcon } from "@/components/icons";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useState, useRef, useEffect } from "react";
import {
  Search,
  Send,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Archive,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Image as ImageIcon,
  FileVideo,
  Sticker,
  Mic,
  Smile,
  Paperclip,
  Edit3,
  X,
  MessageCircle,
  Camera,
  Smartphone,
  Globe,
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
  priority_score: number | null;
  vip_flag: boolean | null;
};

type SessionMessage = {
  id: string;
  role: string;
  content: string;
  channel: string | null;
  metadata: {
    is_draft?: boolean;
    sent?: boolean;
    // Messenger/WhatsApp attachment fields
    attachment_type?: "image" | "video" | "audio" | "sticker" | "file";
    attachment_url?: string;
    attachment_preview?: string;   // thumbnail URL
    attachment_name?: string;
    image_url?: string;            // legacy field
    sticker_url?: string;
    // Draft compose state
    draft_edit?: string;           // edited version of draft
  } | null;
  created_at: string | null;
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  messenger: MessageCircle,
  whatsapp: MessageCircle,
  instagram: Camera,
  web: Globe,
  sms: Smartphone,
};

const CHANNEL_BG: Record<string, string> = {
  messenger: "bg-blue-500",
  whatsapp: "bg-green-500",
  instagram: "bg-pink-500",
  web: "bg-purple-500",
  sms: "bg-teal-500",
};

const PAGE_SIZE = 25;

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "এখন";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-BD", { month: "short", day: "numeric" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Generate a consistent color for an avatar based on the external_id
function avatarColor(id: string | null): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-pink-500", "bg-rose-500",
    "bg-emerald-500", "bg-amber-500", "bg-emerald-500", "bg-teal-500",
    "bg-cyan-500", "bg-indigo-500",
  ];
  if (!id) return colors[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function AvatarCircle({ name, externalId, size = "md" }: { name?: string | null; externalId?: string | null; size?: "sm" | "md" | "lg" }) {
  const letter = (name?.[0] || externalId?.[0] || "?").toUpperCase();
  const bg = avatarColor(externalId || name);
  const sz = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-12 text-lg" : "size-10 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", bg, sz)}>
      {letter}
    </div>
  );
}

function InboxPage() {
  const qc = useQueryClient();
  const fetchSessions = useServerFn(listSessions);
  const fetchMessages = useServerFn(getSessionMessages);
  const doAssign = useServerFn(assignSession);
  const doUpdateStatus = useServerFn(updateSessionStatus);
  const doSendDraft = useServerFn(sendDraftReply);
  const doSendManual = useServerFn(sendManualReply);
  const doSendVoice = useServerFn(sendVoiceReply);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({}); // messageId → edited text
  const [composeText, setComposeText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);

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
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["inbox-messages", selectedSessionId],
    queryFn: () => fetchMessages({ data: { sessionId: selectedSessionId! } }),
    enabled: Boolean(selectedSessionId),
    refetchInterval: selectedSessionId ? 15_000 : false,
    placeholderData: (prev) => prev,
    staleTime: 3_000,
  });

  // Smart auto-scroll: only scroll to bottom if user is already near the bottom
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMsgCountRef = useRef(0);

  // Attach scroll listener to the ScrollArea viewport
  useEffect(() => {
    const scrollArea = document.querySelector("[data-radix-scroll-area-viewport]");
    if (!scrollArea) return;
    const onScroll = () => {
      const threshold = 120;
      const atBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < threshold;
      setIsNearBottom(atBottom);
      if (atBottom) setHasNewMessages(false);
    };
    scrollArea.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollArea.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (messages?.length) {
      const countChanged = messages.length !== prevMsgCountRef.current;
      prevMsgCountRef.current = messages.length;
      if (isNearBottom) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } else if (countChanged && messages.length > 0) {
        setHasNewMessages(true);
      }
    }
  }, [messages, isNearBottom]);

  const assignMutation = useMutation({
    mutationFn: (data: { sessionId: string; agent: string }) => doAssign({ data }),
    onSuccess: () => { toast.success("Agent assigned"); qc.invalidateQueries({ queryKey: ["inbox-sessions"] }); setAgentInput(""); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { sessionId: string; status: string }) =>
      doUpdateStatus({ data: { sessionId: data.sessionId, status: data.status as any } }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["inbox-sessions"] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const sendDraftMutation = useMutation({
    mutationFn: (data: { messageId: string; sessionId: string }) => doSendDraft({ data }),
    onSuccess: () => { toast.success("Sent OK"); qc.invalidateQueries({ queryKey: ["inbox-messages", selectedSessionId] }); },
    onError: (e: any) => toast.error("Send failed: " + (e.message || "unknown error")),
  });

  const selectedSession = sessionsData?.rows?.find((s: SessionRow) => s.id === selectedSessionId);
  const totalPages = sessionsData ? Math.ceil(sessionsData.total / PAGE_SIZE) : 0;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* ── LEFT: Conversation List ── */}
      <div className={cn(
        "flex flex-col w-full md:w-[340px] lg:w-[360px] border-r border-border/30 shrink-0 bg-card/20",
        showThread ? "hidden md:flex" : "flex"
      )}>
        {/* Search + filter header */}
        <div className="p-3 border-b border-border/20 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearchQuery(searchInput); setPage(0); } }}
              className="pl-9 h-9 text-sm bg-muted/40 border-transparent focus:border-primary/50"
            />
          </div>
          {/* Filter pills */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            {(["all", "active", "resolved", "escalated", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={cn(
                  "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {s === "all" ? "All" : s === "active" ? "Active" : s === "resolved" ? "Done" : s === "escalated" ? "Escalated" : "Archived"}
              </button>
            ))}
          </div>
          {/* Channel filter */}
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(0); }}
            className="w-full h-8 text-xs bg-muted/40 border border-border/30 rounded-md px-2 focus:outline-none cursor-pointer"
          >
            <option value="">All channels</option>
            <option value="messenger">Messenger</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="web">Web</option>
          </select>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {sessionsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : sessionsData?.rows?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
            </div>
          ) : (
            sessionsData?.rows.map((session: SessionRow) => {
              const isSelected = session.id === selectedSessionId;
              const displayName = session.customer_name || `User ${session.external_id?.slice(-6)}` || "Unknown";
              const ChannelIcon = CHANNEL_ICONS[session.channel ?? ""] ?? MessageCircle;
              return (
                <button
                  key={session.id}
                  onClick={() => { setSelectedSessionId(session.id); setAgentInput(session.assigned_agent || ""); setShowThread(true); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border/10",
                    isSelected && "bg-primary/10 border-l-2 border-l-primary"
                  )}
                >
                  <div className="relative shrink-0">
                    <AvatarCircle name={session.customer_name} externalId={session.external_id} size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5"><ChannelIcon className="size-3.5 text-foreground/80" /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-semibold truncate">{displayName}</p>
                        {session.vip_flag && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">VIP</span>
                        )}
                        {!session.vip_flag && (session.priority_score ?? 0) >= 70 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary/15 text-primary border border-primary/30">High</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{timeAgo(session.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">
                        {session.message_count ? `${session.message_count} messages` : "No messages"}
                      </p>
                      {session.status === "escalated" && (
                        <span className="size-2 rounded-full bg-primary shrink-0 ml-2" />
                      )}
                      {session.status === "active" && (
                        <span className="size-2 rounded-full bg-primary shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>

        {/* Pagination */}
        {sessionsData && sessionsData.total > PAGE_SIZE && (
          <div className="shrink-0 flex items-center justify-between border-t border-border/20 px-3 py-2">
            <span className="text-[10px] text-muted-foreground">{sessionsData.total} total</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1 rounded hover:bg-muted disabled:opacity-30">
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="text-[10px] font-bold px-1">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= sessionsData.total}
                className="p-1 rounded hover:bg-muted disabled:opacity-30">
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Chat Thread ── */}
      <div className={cn(
        "flex flex-col flex-1 min-w-0",
        !showThread ? "hidden md:flex" : "flex"
      )}>
        {!selectedSession ? (
          /* Empty state */
          <div className="hidden md:flex flex-col items-center justify-center flex-1 text-center px-8">
            <div className="size-20 rounded-full bg-muted/40 flex items-center justify-center mb-4">
              <Search className="size-8 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-foreground/60">Select a conversation</p>
            <p className="text-sm text-muted-foreground mt-1">Choose from the list to read messages</p>
          </div>
        ) : (
          <>
            {/* Thread header — like Messenger top bar */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-card/30">
              <button onClick={() => setShowThread(false)} className="md:hidden p-1.5 rounded-full hover:bg-muted">
                <ArrowLeft className="size-4" />
              </button>
              <AvatarCircle name={selectedSession.customer_name} externalId={selectedSession.external_id} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">
                  {selectedSession.customer_name || `User ${selectedSession.external_id?.slice(-6)}`}
                </p>
                <div className="flex items-center gap-1.5">
                  {/* Online indicator dot */}
                  <span className="size-1.5 rounded-full bg-primary" />
                  <p className="text-[10px] text-muted-foreground">
                    {(() => { const I = CHANNEL_ICONS[selectedSession.channel ?? ""] ?? MessageCircle; return <I className="size-3.5 inline-block align-[-2px]" />; })()} {selectedSession.channel}
                    {selectedSession.assigned_agent && ` · ${selectedSession.assigned_agent}`}
                  </p>
                </div>
              </div>
              {/* Status badge */}
              <div className="flex items-center gap-1">
                {selectedSession.status === "active" && <CircleDot className="size-3.5 text-primary" />}
                {selectedSession.status === "escalated" && <AlertTriangle className="size-3.5 text-primary" />}
                {selectedSession.status === "resolved" && <CheckCircle2 className="size-3.5 text-primary" />}
                {selectedSession.status === "archived" && <Archive className="size-3.5 text-muted-foreground" />}
                <span className="text-[10px] font-semibold capitalize text-muted-foreground">{selectedSession.status}</span>
              </div>
              <button onClick={() => setShowDetails(v => !v)} className="p-1.5 rounded-full hover:bg-muted">
                <MoreVertical className="size-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Messages area */}
              <div className="flex flex-col flex-1 min-w-0 relative">
                <ScrollArea className="flex-1 px-4 py-4">
                  {messagesLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                  ) : !messages?.length ? (
                    <div className="flex justify-center py-12">
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    </div>
                  ) : (
                    <MessageThread
                      messages={messages}
                      sessionId={selectedSessionId!}
                      session={selectedSession}
                      sendDraftMutation={sendDraftMutation}
                      draftEdits={draftEdits}
                      setDraftEdits={setDraftEdits}
                    />
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* New messages indicator */}
                {hasNewMessages && !isNearBottom && (
                  <button
                    onClick={() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                      setHasNewMessages(false);
                    }}
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 flex items-center gap-1.5 hover:bg-primary/90 transition-colors animate-in fade-in slide-in-from-bottom-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                    New messages
                  </button>
                )}

                {/* ── Messenger-style Compose Bar — only when thread open ── */}
                {showThread && (
                  <div className="shrink-0 border-t border-border/20 bg-card/30 px-3 py-2 sticky bottom-0">
                    {/* Character count row */}
                    {composeText.length > 100 && (
                      <div className="flex justify-end mb-1">
                        <span className={cn(
                          "text-[10px] font-semibold tabular-nums",
                          composeText.length > 900 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {composeText.length} / 1000
                        </span>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 flex items-end gap-1 rounded-2xl bg-muted/40 border border-border/30 px-3 py-2 min-h-[40px]">
                        <Textarea
                          ref={composeRef}
                          placeholder="Type a message…"
                          value={composeText}
                          onChange={(e) => {
                            setComposeText(e.target.value);
                            // Auto-grow: reset then expand up to 4 rows
                            const el = e.target;
                            el.style.height = "auto";
                            const lineH = 20; // ~20px per line
                            const maxH = lineH * 4 + 16; // 4 rows + padding
                            el.style.height = Math.min(el.scrollHeight, maxH) + "px";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              const text = composeText.trim();
                              if (text && selectedSession) {
                                doSendManual({ data: { sessionId: selectedSession.id, text } })
                                  .then(() => {
                                    setComposeText("");
                                    if (composeRef.current) composeRef.current.style.height = "22px";
                                    qc.invalidateQueries({ queryKey: ["inbox-messages", selectedSessionId] });
                                    toast.success("Sent");
                                  })
                                  .catch((e: any) => toast.error("Send failed: " + (e.message || "unknown")));
                              }
                            }
                          }}
                          className="flex-1 bg-transparent border-0 shadow-none resize-none text-sm leading-snug min-h-[22px] max-h-[96px] overflow-y-auto p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          rows={1}
                          style={{ height: "22px" }}
                        />
                        <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                          <VoiceRecorder
                            onText={(text) => {
                              setComposeText(text);
                              if (composeRef.current) {
                                composeRef.current.style.height = "auto";
                                composeRef.current.style.height = Math.min(composeRef.current.scrollHeight, 96) + "px";
                              }
                            }}
                            onAudioBlob={async (blob) => {
                              if (!selectedSession) return;
                              try {
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const result = String(reader.result);
                                  const base64 = result.slice(result.indexOf(",") + 1);
                                  await doSendVoice({
                                    data: {
                                      sessionId: selectedSession.id,
                                      audio: base64,
                                      mimeType: blob.type || "audio/webm",
                                    },
                                  });
                                  qc.invalidateQueries({ queryKey: ["inbox-messages", selectedSessionId] });
                                  toast.success("Voice sent");
                                };
                                reader.readAsDataURL(blob);
                              } catch (e: any) {
                                toast.error("Voice send failed: " + (e.message || "unknown"));
                              }
                            }}
                          />
                          <button
                            type="button"
                            title="Emoji"
                            className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Smile className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Attach file"
                            className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Paperclip className="size-4" />
                          </button>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        disabled={!composeText.trim()}
                        onClick={async () => {
                          const text = composeText.trim();
                          if (!text || !selectedSession) return;
                          try {
                            await doSendManual({ data: { sessionId: selectedSession.id, text } });
                            setComposeText("");
                            if (composeRef.current) composeRef.current.style.height = "22px";
                            qc.invalidateQueries({ queryKey: ["inbox-messages", selectedSessionId] });
                            toast.success("Sent");
                          } catch (e: any) {
                            toast.error("Send failed: " + (e.message || "unknown"));
                          }
                        }}
                        className={cn(
                          "size-9 rounded-full shrink-0 transition-all",
                          composeText.trim()
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                      >
                        <Send className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Details sidebar — toggled via ⋮ */}
              {showDetails && (
                <div className="hidden lg:flex flex-col w-64 shrink-0 border-l border-border/20 bg-card/20">
                  <div className="p-4 border-b border-border/20">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <AvatarCircle name={selectedSession.customer_name} externalId={selectedSession.external_id} size="lg" />
                      <p className="text-sm font-bold">{selectedSession.customer_name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{selectedSession.external_id}</p>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4 space-y-4">
                    {/* Quick status */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Status</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["active", "resolved", "escalated", "archived"] as const).map(s => (
                          <button
                            key={s}
                            disabled={statusMutation.isPending || selectedSession.status === s}
                            onClick={() => statusMutation.mutate({ sessionId: selectedSession.id, status: s })}
                            className={cn(
                              "py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors",
                              selectedSession.status === s
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 hover:bg-muted text-muted-foreground"
                            )}
                          >
                            {s === "active" ? "Active" : s === "resolved" ? "Done" : s === "escalated" ? "Escalate" : "Archive"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Assign agent */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Assign agent</p>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Agent name"
                          value={agentInput}
                          onChange={(e) => setAgentInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && agentInput.trim()) assignMutation.mutate({ sessionId: selectedSession.id, agent: agentInput.trim() }); }}
                          className="h-8 text-xs"
                        />
                        <Button size="sm" disabled={!agentInput.trim() || assignMutation.isPending}
                          onClick={() => assignMutation.mutate({ sessionId: selectedSession.id, agent: agentInput.trim() })}
                          className="h-8 px-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                          {assignMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                        </Button>
                      </div>
                      {selectedSession.assigned_agent && (
                        <p className="text-[10px] text-muted-foreground">Currently: <span className="text-foreground font-semibold">{selectedSession.assigned_agent}</span></p>
                      )}
                    </div>

                    {/* Info */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Info</p>
                      <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Channel</span><span className="font-semibold capitalize">{selectedSession.channel}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Messages</span><span className="font-semibold">{selectedSession.message_count}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span className="font-semibold">{selectedSession.started_at ? new Date(selectedSession.started_at).toLocaleDateString() : "—"}</span></div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Message thread component ─────────────────────────────────────────────────
// Groups consecutive messages from the same sender, shows tails on the last
// bubble of each group, timestamps shown between groups.

/** Renders attachment content (image, video, sticker, audio) inside a bubble */
function AttachmentRenderer({ msg }: { msg: SessionMessage }) {
  const meta = msg.metadata;
  if (!meta) return null;

  const attachType = meta.attachment_type;
  const imageUrl = meta.image_url || (attachType === "image" ? meta.attachment_url : null);
  const audioUrl = attachType === "audio" ? meta.attachment_url : null;
  const stickerUrl = meta.sticker_url || (attachType === "sticker" ? meta.attachment_url : null);

  if (stickerUrl || attachType === "sticker") {
    const src = stickerUrl || meta.attachment_url;
    return src ? (
      <img
        src={src}
        alt="sticker"
        width={80}
        height={80}
        className="rounded-lg object-contain"
        style={{ width: 80, height: 80 }}
      />
    ) : null;
  }

  if (imageUrl) {
    return (
      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={imageUrl}
          alt="attachment"
          className="rounded-xl max-w-[240px] border border-border/30 shadow-sm hover:opacity-90 transition-opacity cursor-pointer object-cover"
          style={{ maxWidth: 240 }}
        />
      </a>
    );
  }

  if (attachType === "video") {
    return (
      <div className="relative w-[180px] h-[110px] bg-black/40 rounded-xl border border-border/30 flex items-center justify-center overflow-hidden">
        {meta.attachment_preview && (
          <img src={meta.attachment_preview} alt="video thumb" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="relative z-10 size-10 rounded-full bg-black/60 flex items-center justify-center">
          <FileVideo className="size-5 text-white" />
        </div>
        <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/70 font-semibold">Video</span>
      </div>
    );
  }

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2 p-1">
        <Mic className="size-3.5 shrink-0 text-primary" />
        <audio controls src={audioUrl} className="h-8 max-w-[200px]" />
      </div>
    );
  }

  return null;
}

function MessageThread({
  messages,
  sessionId,
  session,
  sendDraftMutation,
  draftEdits,
  setDraftEdits,
}: {
  messages: SessionMessage[];
  sessionId: string;
  session: SessionRow;
  sendDraftMutation: any;
  draftEdits: Record<string, string>;
  setDraftEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  // Track which draft textareas are in edit mode
  const [editingDrafts, setEditingDrafts] = useState<Record<string, boolean>>({});

  // Group consecutive messages by role
  type Group = { role: string; messages: SessionMessage[]; groupTime: string | null };
  const groups: Group[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.role === msg.role) {
      last.messages.push(msg);
      last.groupTime = msg.created_at;
    } else {
      groups.push({ role: msg.role, messages: [msg], groupTime: msg.created_at });
    }
  }

  // Find the last user message that has an image (for "Replying to" preview in drafts)
  const lastUserImageUrl = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") {
        const meta = m.metadata;
        if (!meta) continue;
        const url = meta.image_url || (meta.attachment_type === "image" ? meta.attachment_url : null);
        if (url) return url;
        break; // found last user msg but no image
      }
    }
    return null;
  })();

  return (
    <div className="space-y-1">
      {groups.map((group, gi) => {
        const isUser = group.role === "user";
        const showAvatar = isUser;
        const prevGroup = groups[gi - 1];
        // Show date divider if day changed or first group
        const showDate = !prevGroup || (
          prevGroup.groupTime && group.groupTime &&
          new Date(prevGroup.groupTime).toDateString() !== new Date(group.groupTime).toDateString()
        );

        return (
          <div key={gi}>
            {/* Date divider */}
            {showDate && group.groupTime && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                  {new Date(group.groupTime).toLocaleDateString("en-BD", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <div className="flex-1 h-px bg-border/30" />
              </div>
            )}

            {/* Message group */}
            <div className={cn("flex gap-2 items-end mb-1", isUser ? "justify-start" : "justify-end")}>
              {/* User avatar — left side */}
              {showAvatar && (
                <div className="shrink-0 mb-0.5">
                  <div className={cn("size-7 rounded-full flex items-center justify-center text-xs font-bold text-white", avatarColor(session.external_id))}>
                    {(session.customer_name?.[0] || session.external_id?.[0] || "?").toUpperCase()}
                  </div>
                </div>
              )}

              {/* Bubbles */}
              <div className={cn("flex flex-col gap-0.5 max-w-[72%]", isUser ? "items-start" : "items-end")}>
                {group.messages.map((msg, mi) => {
                  const isFirst = mi === 0;
                  const isLast = mi === group.messages.length - 1;
                  const isDraft = !isUser && msg.metadata?.is_draft === true;
                  const isEditing = editingDrafts[msg.id] ?? false;

                  // Determine attachment presence
                  const meta = msg.metadata;
                  const hasAttachment = meta && (
                    meta.image_url ||
                    meta.attachment_url ||
                    meta.sticker_url
                  );
                  const hasContent = msg.content && msg.content.trim().length > 0;

                  // Bubble shape: grouped messages share rounded corners
                  const bubbleRound = isUser
                    ? cn(
                        "rounded-2xl",
                        isFirst && isLast ? "rounded-bl-sm" : isLast ? "rounded-bl-sm" : "rounded-bl-md rounded-tl-md",
                        !isLast && !isFirst ? "rounded-tl-md rounded-bl-md" : "",
                      )
                    : cn(
                        "rounded-2xl",
                        isFirst && isLast ? "rounded-br-sm" : isLast ? "rounded-br-sm" : "rounded-br-md rounded-tr-md",
                        !isLast && !isFirst ? "rounded-tr-md rounded-br-md" : "",
                      );

                  if (isDraft) {
                    // ── Draft bubble (redesigned) ──────────────────────────
                    const currentText = draftEdits[msg.id] ?? msg.content;
                    return (
                      <div key={msg.id} className="group/msg flex flex-col w-full max-w-[320px]">
                        <div className={cn(
                          "px-3 py-2.5 text-sm leading-relaxed relative",
                          bubbleRound,
                          "bg-emerald-950/40 border border-emerald-500/25 text-foreground"
                        )}>
                          {/* Draft label */}
                          <span className="text-[9px] font-black uppercase text-emerald-400 block mb-2 tracking-wider flex items-center gap-1">
                            <SparkleIcon size={10} /> Draft · AI suggestion
                          </span>

                          {/* Replying-to image preview */}
                          {lastUserImageUrl && (
                            <div className="mb-2 flex items-center gap-1.5">
                              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Replying to</span>
                              <img
                                src={lastUserImageUrl}
                                alt="replying to"
                                className="size-8 rounded-md object-cover border border-border/30"
                              />
                            </div>
                          )}

                          {/* Editable textarea */}
                          <Textarea
                            value={currentText}
                            readOnly={!isEditing}
                            onChange={(e) => setDraftEdits((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                            rows={3}
                            className={cn(
                              "w-full text-sm resize-none bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground/40",
                              !isEditing && "cursor-default select-text"
                            )}
                          />

                          {/* Timestamp on hover */}
                          <span className={cn(
                            "text-[9px] mt-0.5 block opacity-0 group-hover/msg:opacity-70 transition-opacity text-emerald-400/70 text-right"
                          )}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>

                        {/* Action row */}
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          {/* Edit toggle */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingDrafts((prev) => ({ ...prev, [msg.id]: !isEditing }))}
                            className={cn(
                              "h-7 px-2.5 text-[11px] font-bold gap-1 border",
                              isEditing
                                ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            )}
                          >
                            <Edit3 className="size-3" />
                            {isEditing ? "Done" : "Edit"}
                          </Button>

                          {/* Send */}
                          <Button
                            size="sm"
                            disabled={sendDraftMutation.isPending}
                            onClick={() =>
                              sendDraftMutation.mutate({
                                messageId: msg.id,
                                sessionId,
                                editedText: draftEdits[msg.id] ?? msg.content,
                              })
                            }
                            className="h-7 px-3 text-[11px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground border-0 gap-1"
                          >
                            {sendDraftMutation.isPending
                              ? <Loader2 className="size-3 animate-spin" />
                              : <><Send className="size-3" /> Send</>
                            }
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  // ── Regular bubble ─────────────────────────────────────
                  return (
                    <div key={msg.id} className="group/msg flex flex-col">
                      <div
                        className={cn(
                          "text-sm leading-relaxed relative overflow-hidden",
                          bubbleRound,
                          // Only add padding if there's text content or it's a non-image attachment
                          (hasContent || (hasAttachment && meta?.attachment_type !== "image" && meta?.attachment_type !== "sticker"))
                            ? "px-3 py-2"
                            : "p-1",
                          isUser
                            ? "bg-muted/60 text-foreground"
                            : "bg-secondary border border-primary/20 text-foreground"
                        )}
                      >
                        {/* Attachment rendering (before text) */}
                        {hasAttachment && <AttachmentRenderer msg={msg} />}

                        {/* Text content — only render if non-empty */}
                        {hasContent && (
                          <span className={cn("whitespace-pre-wrap break-words", hasAttachment && "mt-1.5 block")}>
                            {msg.content}
                          </span>
                        )}

                        {/* Timestamp on hover */}
                        <span className={cn(
                          "text-[9px] mt-0.5 block opacity-0 group-hover/msg:opacity-70 transition-opacity",
                          isUser ? "text-muted-foreground text-left" : "text-foreground/50 text-right"
                        )}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {/* Group timestamp */}
                {group.groupTime && (
                  <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                    {formatTime(group.groupTime)}
                  </span>
                )}
              </div>

              {/* Bot avatar placeholder — right side (keeps alignment) */}
              {!isUser && <div className="size-7 shrink-0" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
