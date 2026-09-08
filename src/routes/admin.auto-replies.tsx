import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listTemplates, saveTemplate, deleteTemplate, testRuleMatch } from "@/lib/auto-replies.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare, Plus, Trash2, Edit2, Globe, Layout, Sparkles, Loader2,
  User, ImageIcon, Zap, Send, Bot, Search, X, ChevronLeft, PanelLeftClose,
  PanelLeft, CheckCircle2, AlertCircle, Clock, ArrowRight
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/console.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/auto-replies")({
  component: AutoRepliesPage,
});

// ── Chat message type ────────────────────────────────────────────────────────
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  matchedTemplate?: string | null;
  matchedRule?: string | null;
  variant?: string | null;
};

// ── Template card (sidebar) ──────────────────────────────────────────────────
function TemplateCard({
  t,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  canEdit,
}: {
  t: any;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl p-3 md:p-3 cursor-pointer transition-all duration-200 border active:bg-muted/60",
        isActive
          ? "bg-primary/10 border-primary/30 shadow-sm"
          : "bg-transparent border-transparent hover:bg-muted/40 hover:border-border/30"
      )}
    >
      <div className={cn(
        "size-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
        isActive ? "bg-primary/20" : "bg-muted/60"
      )}>
        <MessageSquare className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold truncate">{t.name}</h4>
          <span className={cn(
            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border",
            t.status === "published"
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border/30"
          )}>
            {t.status || "draft"}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5 italic">
          "{t.template_text?.slice(0, 60)}{t.template_text?.length > 60 ? "..." : ""}"
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[9px] uppercase font-bold bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground">
            {t.platform}
          </span>
          <span className="text-[9px] uppercase font-bold bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground">
            {t.language}
          </span>
          {t.trigger_keywords?.length > 0 && (
            <span className="text-[9px] text-primary/70">
              {t.trigger_keywords.length} keywords
            </span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Edit2 className="size-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) onDelete(); }}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2 bg-muted/40 border border-border/30 rounded-full px-4 py-1.5 text-[11px] text-muted-foreground">
          {msg.matchedTemplate ? (
            <>
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Matched: <strong className="text-foreground">{msg.matchedTemplate}</strong></span>
              {msg.variant && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">v{msg.variant}</span>}
            </>
          ) : (
            <>
              <AlertCircle className="size-3 text-amber-500" />
              <span>{msg.content}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3 my-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
          <Bot className="size-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted/60 border border-border/30 rounded-bl-md"
      )}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.matchedTemplate && !isUser && (
          <div className="mt-2 pt-2 border-t border-border/20 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Sparkles className="size-3 text-primary" />
            <span>Template: <strong className="text-foreground">{msg.matchedTemplate}</strong></span>
            {msg.matchedRule && <span className="text-muted-foreground/60">via {msg.matchedRule}</span>}
          </div>
        )}
      </div>
      {isUser && (
        <div className="size-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-1">
          <User className="size-4 text-blue-500" />
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function AutoRepliesPage() {
  const queryClient = useQueryClient();
  const fetchTemplates = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const remove = useServerFn(deleteTemplate);
  const testMatch = useServerFn(testRuleMatch);
  const fetchMyRole = useServerFn(getMyRole);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome! I'm your Auto-Reply preview assistant. Type a customer message below to test which template matches. You can also manage templates from the sidebar.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const roleQuery = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["auto-reply-templates"],
    queryFn: () => fetchTemplates(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => save({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-templates"] });
      toast.success("Template saved");
      setEditing(null);
      setIsNew(false);
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-templates"] });
      toast.success("Template deleted");
      if (activeTemplate) setActiveTemplate(null);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userRole = roleQuery.data?.role || "viewer";
  const canEdit = userRole === "admin" || userRole === "editor";

  const filteredTemplates = templates?.filter((t: any) =>
    !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.template_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.trigger_keywords?.some((k: string) => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isTesting) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTesting(true);

    try {
      const result = await testMatch({ message: text });

      if (result) {
        // Show matched template as assistant reply
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.templateText,
          timestamp: new Date(),
          matchedTemplate: result.templateName,
          matchedRule: result.ruleName,
          variant: result.variant,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // System message about the match
        const sysMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: "",
          timestamp: new Date(),
          matchedTemplate: result.templateName,
          matchedRule: result.ruleName,
          variant: result.variant,
        };
        setMessages((prev) => [...prev, sysMsg]);
      } else {
        // No match
        const sysMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: "No template matched — AI would generate a dynamic reply",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, sysMsg]);

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "No auto-reply template matched this message. The AI engine would generate a dynamic response based on training data and product catalog.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `Error: ${err.message || "Test failed"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTesting(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Chat cleared. Type a customer message to test auto-reply matching.",
      timestamp: new Date(),
    }]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading templates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] animate-in fade-in duration-500 -m-5 md:-m-8 relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setSidebarOpen(false)} />
      )}
      {/* ── Sidebar: Template List ─────────────────────────────────────── */}
      <div className={cn(
        "border-b md:border-r border-border/40 bg-background md:bg-background/50 backdrop-blur-sm flex flex-col transition-all duration-300 shrink-0 z-30",
        sidebarOpen
          ? "fixed md:static inset-0 md:inset-auto md:w-80 md:h-auto bottom-[45vh] md:bottom-auto h-[55vh] md:h-auto"
          : "w-full md:w-0 h-0 md:h-auto overflow-hidden"
      )}>
        {/* Sidebar header */}
        <div className="p-4 border-b border-border/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Templates
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">
                {templates?.length || 0}
              </span>
            </h2>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="size-8 p-0"
                onClick={() => { setIsNew(true); setEditing(null); }}
              >
                <Plus className="size-4" />
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredTemplates?.map((t: any) => (
            <TemplateCard
              key={t.id}
              t={t}
              isActive={activeTemplate === t.id}
              onSelect={() => setActiveTemplate(activeTemplate === t.id ? null : t.id)}
              onEdit={() => { setEditing(t); setIsNew(false); }}
              onDelete={() => deleteMutation.mutate(t.id)}
              canEdit={canEdit}
            />
          ))}
          {filteredTemplates?.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-xs">
              {searchQuery ? "No templates match your search" : "No templates yet"}
            </div>
          )}
        </div>
      </div>

      {/* ── Main: Chat Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-border/30 bg-background/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 md:p-1.5 rounded-lg bg-muted/40 md:bg-transparent hover:bg-muted/60 text-foreground md:text-muted-foreground transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Bot className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Auto-Reply Preview</h3>
                <p className="text-[10px] text-muted-foreground">Test how templates match customer messages</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <User className="size-3" />
              Role: <strong className="text-foreground uppercase">{userRole}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-[10px] h-7">
              Clear
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {isTesting && (
              <div className="flex gap-3 my-3 justify-start">
                <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="size-4 text-primary" />
                </div>
                <div className="bg-muted/60 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Matching template...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border/30 bg-background/50 backdrop-blur-sm p-3 md:p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a customer message to test... (e.g., 'দাম কত?' or 'Do you have this in blue?')"
                  className="pr-10 h-11 md:h-11 rounded-xl bg-muted/30 border-border/40 text-sm"
                  disabled={isTesting}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/50">
                  {inputValue.length}/500
                </div>
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isTesting}
                className="size-11 rounded-xl shrink-0"
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1"><Zap className="size-3" /> Tests against auto-reply rules + template keywords</span>
              <span className="flex items-center gap-1"><Clock className="size-3" /> Results in real-time</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit/Create Panel (slide-over) ─────────────────────────────── */}
      {(isNew || editing) && (
        <div className="w-96 border-l border-border/40 bg-background/50 backdrop-blur-sm flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-border/30 flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              {editing ? <Edit2 className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
              {editing ? "Edit Template" : "New Template"}
            </h3>
            <button
              onClick={() => { setEditing(null); setIsNew(false); }}
              className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              mutation.mutate({
                id: editing?.id,
                name: formData.get("name"),
                platform: formData.get("platform"),
                language: formData.get("language"),
                template_text: formData.get("template_text"),
                image_url: formData.get("image_url") || undefined,
                caption: formData.get("caption") as string || undefined,
                trigger_keywords: (formData.get("trigger_keywords") as string || "")
                  .split(",")
                  .map((k: string) => k.trim())
                  .filter(Boolean),
                variables: [],
              });
            }}
            className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Template Name</Label>
              <Input name="name" defaultValue={editing?.name} placeholder="e.g., Welcome Message" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Platform</Label>
                <Select name="platform" defaultValue={editing?.platform || "all"}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="messenger">Messenger</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="web">Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Language</Label>
                <Select name="language" defaultValue={editing?.language || "bn"}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">Bengali</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="banglish">Banglish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message Text</Label>
              <Textarea
                name="template_text"
                defaultValue={editing?.template_text}
                rows={5}
                placeholder="e.g., Welcome! How can I help you today?"
                required
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Use {"{product_name}"}, {"{price}"} for dynamic values
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="size-3 text-muted-foreground" /> Media URL (optional)
              </Label>
              <Input
                name="image_url"
                type="url"
                defaultValue={editing?.image_url}
                placeholder="https://..."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Caption (optional)</Label>
              <Input name="caption" defaultValue={editing?.caption} placeholder="Image caption" maxLength={500} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Zap className="size-3 text-muted-foreground" /> Trigger Keywords (optional)
              </Label>
              <Input
                name="trigger_keywords"
                defaultValue={editing?.trigger_keywords?.join(", ")}
                placeholder="price, দাম, order (comma separated)"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                When a message contains these keywords, this template is used instead of AI
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={mutation.isPending} className="flex-1">
                {mutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
