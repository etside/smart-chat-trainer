import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Mic, Download, Volume2, Loader2, Search, RefreshCw, MessageSquare, Settings2, Save, Play, Wand2, Upload, Trash2, CheckCircle2, Plus, Copy, Mic2, AudioLines } from "lucide-react";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getExtraSettingsAdmin, updateExtraSettings } from "@/lib/extra-settings.functions";
import { textToSpeech } from "@/lib/tts.functions";
import {
  listVoiceClones,
  saveVoiceClone,
  selectVoiceClone,
  deleteVoiceClone,
  trainVoiceClone,
} from "@/lib/voice-clones.functions";

export const Route = createFileRoute("/admin/voice")({
  component: VoicePage,
});

// ── Server fn ────────────────────────────────────────────────────────────────

const listVoiceMessages = createServerFn({ method: "GET" })
  .validator((d: { page?: number; channel?: string; search?: string }) => d)
  .handler(async ({ data }) => {
    const { page = 0, channel, search } = data;
    const size = 30;

    let query = supabaseAdmin
      .from("session_messages")
      .select(`
        id, role, content, channel, metadata, created_at,
        session_id
      `, { count: "exact" })
      .or("metadata->>audioUrl.not.is.null,content.ilike.[Customer sent a voice message]%")
      .order("created_at", { ascending: false })
      .range(page * size, (page + 1) * size - 1);

    if (channel) query = query.eq("channel", channel);
    if (search) query = query.ilike("content", `%${search}%`);

    const { data: rows, count } = await query;

    return {
      rows: rows ?? [],
      total: count ?? 0,
      page,
      size,
    };
  });

// ── Component ────────────────────────────────────────────────────────────────

function VoicePage() {
  const fn = useServerFn(listVoiceMessages);
  const fetchExtra = useServerFn(getExtraSettingsAdmin);
  const saveExtra = useServerFn(updateExtraSettings);
  const doTTS = useServerFn(textToSpeech);
  const doListClones = useServerFn(listVoiceClones);
  const doSaveClone = useServerFn(saveVoiceClone);
  const doSelectClone = useServerFn(selectVoiceClone);
  const doDeleteClone = useServerFn(deleteVoiceClone);
  const doTrainClone = useServerFn(trainVoiceClone);

  const [page, setPage] = useState(0);
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // TTS config state
  const [showConfig, setShowConfig] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<"fish" | "mimo" | "gemini">("gemini");
  const [fishKey, setFishKey] = useState("");
  const [fishModelId, setFishModelId] = useState("");
  const [previewText, setPreviewText] = useState("আমাদের পেজে স্বাগতম! আজকে কি সাহায্য করতে পারি?");
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRef = useRef<HTMLAudioElement>(null);

  // Clone panel state
  const [showClonePanel, setShowClonePanel] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneRefId, setCloneRefId] = useState("");
  const [cloneSampleText, setCloneSampleText] = useState("");
  const [cloneAudioUrl, setCloneAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [editingClone, setEditingClone] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: extraData } = useQuery({
    queryKey: ["extra-settings"],
    queryFn: () => fetchExtra(),
  });

  const clonesQuery = useQuery({
    queryKey: ["voice-clones"],
    queryFn: () => doListClones(),
  });

  // Load settings once
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  if (extraData && !settingsLoaded) {
    setTtsProvider((extraData.voiceProvider as any) || "gemini");
    setFishKey(extraData.fishAudioApiKey || "");
    setFishModelId(extraData.fishAudioModelId || "");
    setSettingsLoaded(true);
  }

  const saveTts = useMutation({
    mutationFn: () => saveExtra({ data: { voiceProvider: ttsProvider, fishAudioApiKey: fishKey, fishAudioModelId: fishModelId } }),
    onSuccess: () => toast.success("Voice settings saved"),
    onError: (e: any) => toast.error(e.message),
  });

  // Clone mutations
  const saveClone = useMutation({
    mutationFn: () => doSaveClone({
      data: {
        name: cloneName,
        description: cloneDesc,
        referenceId: cloneRefId,
        sampleUrl: cloneAudioUrl ?? recordingUrl,
        sampleText: cloneSampleText,
        provider: ttsProvider,
      },
    }),
    onSuccess: (res) => {
      toast.success("Voice clone saved!");
      // If no clone selected yet, auto-select it
      if (!clonesQuery.data?.selectedId && res.id) {
        doSelectClone({ data: { id: res.id } });
      }
      setCloneName(""); setCloneDesc(""); setCloneRefId(""); setCloneSampleText("");
      setCloneAudioUrl(null); setRecordingUrl(null); setEditingClone(null);
      clonesQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectClone = useMutation({
    mutationFn: (id: string) => doSelectClone({ data: { id } }),
    onSuccess: () => {
      toast.success("Active voice updated");
      clonesQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Voice clone TRAINING ──
  const [trainTargetId, setTrainTargetId] = useState<string | null>(null);
  const trainClone = useMutation({
    mutationFn: (id: string) =>
      doTrainClone({
        data: {
          cloneId: id,
          name: cloneName,
          description: cloneDesc,
          sampleUrl: cloneAudioUrl ?? recordingUrl,
          sampleText: cloneSampleText,
        },
      }),
    onSuccess: (res) => {
      setTrainTargetId(null);
      if (res.ok) {
        toast.success(res.message || "Voice clone trained!");
      } else {
        toast.warning(res.message || "Voice training incomplete");
      }
      clonesQuery.refetch();
    },
    onError: (e: any) => {
      setTrainTargetId(null);
      toast.error(e.message);
    },
  });

  const removeClone = useMutation({
    mutationFn: (id: string) => doDeleteClone({ data: { id } }),
    onSuccess: () => {
      toast.success("Voice clone deleted");
      clonesQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function previewTts() {
    setPreviewLoading(true); setPreviewAudio(null);
    try {
      const activeClone = clonesQuery.data?.clones.find(c => c.selected);
      const res = await doTTS({ data: {
        text: previewText,
        provider: ttsProvider,
        modelId: fishModelId || undefined,
        voiceId: activeClone?.reference_id || undefined,
      } });
      if (res.audio) {
        const mimeType = res.mimeType || "audio/mpeg";
        const url = "data:" + mimeType + ";base64," + res.audio;
        setPreviewAudio(url);
        setTimeout(() => previewRef.current?.play(), 100);
      }
    } catch (e: any) { toast.error("TTS failed: " + e.message); }
    setPreviewLoading(false);
  }

  // ── Voice recording ─────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e: any) {
      toast.error("Microphone access denied: " + e.message);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCloneAudioUrl(url);
    toast.success(`Loaded "${file.name}" — ready to use`);
  }

  function startEditClone(clone: any) {
    setEditingClone(clone.id);
    setCloneName(clone.name);
    setCloneDesc(clone.description);
    setCloneRefId(clone.reference_id);
    setCloneSampleText(clone.sample_text);
    setCloneAudioUrl(clone.sample_url);
    setRecordingUrl(null);
    setShowClonePanel(true);
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["voice-messages", page, channel, search],
    queryFn: () => fn({ data: { page, channel: channel || undefined, search: search || undefined } }),
    staleTime: 30_000,
  });

  const total = data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / (data?.size ?? 30)) - 1);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Voice Cloning Panel */}
      <div className="rounded-2xl border border-border/30 bg-card/20 overflow-hidden">
        <button onClick={() => setShowClonePanel(c => !c)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left">
          <div className="size-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Mic2 className="size-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Voice Cloning Studio</p>
            <p className="text-[10px] text-muted-foreground">Record, upload & manage your AI voice clones</p>
          </div>
          <AudioLines className="size-4 text-muted-foreground" />
        </button>
        {showClonePanel && (
          <div className="px-5 pb-5 pt-4 border-t border-border/20 space-y-5">
            {/* Active voice indicator */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Active Voice:</span>
              {clonesQuery.data?.clones.find(c => c.selected) ? (
                <span className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  {clonesQuery.data.clones.find(c => c.selected).name}
                </span>
              ) : (
                <span className="text-xs text-amber-400">Default voice (no clone selected)</span>
              )}
            </div>

            {/* Record / Upload */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Record */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><Mic className="size-3.5 text-pink-400" /> Record Voice</p>
                {!isRecording ? (
                  <Button size="sm" onClick={startRecording} disabled={isRecording} className="gap-1.5 w-full">
                    <Mic className="size-3.5" /> Start Recording
                  </Button>
                ) : (
                  <Button size="sm" onClick={stopRecording} variant="destructive" className="gap-1.5 w-full animate-pulse">
                    <span className="size-2 rounded-full bg-white animate-ping" /> Stop & Save
                  </Button>
                )}
                {(recordingUrl || cloneAudioUrl) && (
                  <audio src={recordingUrl || cloneAudioUrl || undefined} controls className="w-full h-8 mt-2" />
                )}
              </div>

              {/* Upload */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><Upload className="size-3.5 text-violet-400" /> Upload Audio Sample</p>
                <label className="flex flex-col items-center justify-center gap-1.5 w-full h-[62px] rounded-lg border-2 border-dashed border-border/40 hover:border-primary/40 cursor-pointer transition-colors">
                  <Upload className="size-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Click to upload (mp3/wav/webm)</span>
                  <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Clone details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Voice Name</Label>
                <Input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="e.g. Rima (Bangladeshi female)" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Reference / Voice ID</Label>
                <Input value={cloneRefId} onChange={e => setCloneRefId(e.target.value)} placeholder="Fish Audio reference_id or model id" className="h-9 text-xs font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Description</Label>
              <Input value={cloneDesc} onChange={e => setCloneDesc(e.target.value)} placeholder="Voice characteristics, language, tone..." className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Sample Text (what was said)</Label>
              <Textarea value={cloneSampleText} onChange={e => setCloneSampleText(e.target.value)} rows={2} placeholder="Transcript of the audio sample — helps the model understand the voice" className="text-xs resize-none" />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => saveClone.mutate()} disabled={saveClone.isPending || !cloneName.trim()} className="gap-1.5 h-8">
                {saveClone.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {editingClone ? "Update Voice Clone" : "Save Voice Clone"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // If we have an editing clone id, train it directly;
                  // otherwise save first to get an id, then train.
                  const doTrain = (id: string) => trainClone.mutate(id);
                  if (editingClone) {
                    doTrain(editingClone);
                  } else if (clonesQuery.data?.clones.find(c => c.name === cloneName)) {
                    const existing = clonesQuery.data.clones.find(c => c.name === cloneName);
                    doTrain(existing.id);
                  } else {
                    saveClone.mutate(undefined, {
                      onSuccess: (res: any) => {
                        if (res?.id) doTrain(res.id);
                        else toast.error("Could not train: no clone id");
                      },
                    });
                  }
                }}
                disabled={trainClone.isPending || saveClone.isPending || !cloneName.trim()}
                className="gap-1.5 h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                {trainClone.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                Train Voice Clone
              </Button>
              {editingClone && (
                <Button size="sm" variant="ghost" onClick={() => { setEditingClone(null); setCloneName(""); setCloneDesc(""); setCloneRefId(""); setCloneSampleText(""); setCloneAudioUrl(null); setRecordingUrl(null); }}>
                  Cancel Edit
                </Button>
              )}
            </div>

            {/* Clone library */}
            <div className="pt-3 border-t border-border/20">
              <p className="text-[10px] uppercase tracking-wider font-black text-muted-foreground mb-2">Saved Voice Clones ({clonesQuery.data?.clones.length ?? 0})</p>
              {clonesQuery.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : clonesQuery.data?.clones.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-4 text-center">No voice clones yet — record or upload a sample above to create your first clone.</p>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2 pr-2">
                    {clonesQuery.data?.clones.map((clone) => (
                      <div key={clone.id} className={cn(
                        "p-3 rounded-xl border flex items-center gap-3",
                        clone.selected ? "bg-green-500/10 border-green-500/30" : "bg-muted/20 border-border/20"
                      )}>
                        <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0", clone.selected ? "bg-green-500/20 text-green-400" : "bg-muted/40 text-muted-foreground")}>
                          {clone.selected ? <CheckCircle2 className="size-4" /> : <Mic2 className="size-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{clone.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{clone.description || clone.provider} {clone.quality_score > 0 && `· ${clone.quality_score}%`}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {clone.sample_url && (
                            <audio src={clone.sample_url} controls className="w-24 h-7" />
                          )}
                          <Button size="icon" variant="ghost" className="size-9" title="Test voice" onClick={() => {
                            setPreviewText("এই ভয়েসটা টেস্ট করছি।"); setFishModelId(clone.reference_id); previewTts();
                          }}>
                            <Volume2 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-9" title="Edit" onClick={() => startEditClone(clone)}>
                            <Settings2 className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-emerald-400"
                            title="Train voice clone"
                            onClick={() => trainClone.mutate(clone.id)}
                            disabled={trainClone.isPending}
                          >
                            {trainClone.isPending && trainTargetId === clone.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="size-3.5" />
                            )}
                          </Button>
                          {!clone.selected && (
                            <Button size="icon" variant="ghost" className="size-9" title="Set active" onClick={() => selectClone.mutate(clone.id)}>
                              <CheckCircle2 className="size-3.5 text-green-500" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="size-7 text-red-400" title="Delete" onClick={() => removeClone.mutate(clone.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TTS Config Panel */}
      <div className="rounded-2xl border border-border/30 bg-card/20 overflow-hidden">
        <button onClick={() => setShowConfig(c => !c)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left">
          <div className="size-8 rounded-xl bg-pink-500 flex items-center justify-center">
            <Wand2 className="size-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">TTS Settings</p>
            <p className="text-[10px] text-muted-foreground">Configure provider, preview & test voices</p>
          </div>
          <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-black uppercase border",
            ttsProvider === "fish" ? "bg-pink-500/10 text-pink-400 border-pink-500/20" : ttsProvider === "mimo" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
          )}>{ttsProvider === "fish" ? "Fish Audio" : ttsProvider === "mimo" ? "MiMo TTS" : "Gemini TTS"}</span>
          <Settings2 className="size-4 text-muted-foreground" />
        </button>
        {showConfig && (
          <div className="px-5 pb-5 pt-4 border-t border-border/20 space-y-4">
            {/* Provider picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">TTS Provider</Label>
              <div className="flex gap-2">
                {(["fish", "mimo", "gemini"] as const).map(p => (
                  <button key={p} onClick={() => setTtsProvider(p)} className={cn(
                    "flex-1 py-2.5 rounded-xl border text-xs font-bold transition-colors",
                    ttsProvider === p ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50"
                  )}>
                    {p === "fish" ? "Fish Audio (voice cloning)" : p === "mimo" ? "MiMo TTS (free)" : "Gemini TTS (free)"}
                  </button>
                ))}
              </div>
            </div>
            {/* Fish Audio config */}
            {ttsProvider === "fish" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Fish Audio API Key</Label>
                  <input type="password" value={fishKey} onChange={e => setFishKey(e.target.value)} placeholder="fish_sk_..." className="w-full h-9 rounded-md border border-border/40 bg-background/50 px-3 text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Voice Clone Model ID</Label>
                  <input value={fishModelId} onChange={e => setFishModelId(e.target.value)} placeholder="Model or reference ID" className="w-full h-9 rounded-md border border-border/40 bg-background/50 px-3 text-xs font-mono" />
                  <p className="text-[9px] text-muted-foreground">Leave blank to use Fish Audio default voice</p>
                </div>
              </div>
            )}
            {ttsProvider === "mimo" && (
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-xs text-blue-400 font-semibold">MiMo TTS uses your existing AI API key from Settings. No additional config needed.</p>
              </div>
            )}
            {ttsProvider === "gemini" && (
              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <p className="text-xs text-purple-400 font-semibold">Gemini TTS uses GEMINI_API_KEY from .env. Free tier included, no credit card.</p>
              </div>
            )}
            {/* Preview */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">Preview Text</Label>
              <div className="flex gap-2">
                <Textarea value={previewText} onChange={e => setPreviewText(e.target.value)} rows={2} className="text-xs resize-none flex-1" />
                <Button size="sm" onClick={previewTts} disabled={previewLoading} className="h-auto px-3 shrink-0 gap-1.5">
                  {previewLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Test TTS
                </Button>
              </div>
              {previewAudio && <audio ref={previewRef} src={previewAudio} controls className="w-full h-8 mt-1" />}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveTts.mutate()} disabled={saveTts.isPending} className="gap-1.5 h-8">
                {saveTts.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Voice Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Voice Messages</h1>
            <p className="text-sm text-muted-foreground">Audio messages from customers and AI voice replies</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(0); } }}
            className="pl-9 h-9"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setPage(0); }}
          className="h-9 text-xs bg-muted/40 border border-border/30 rounded-md px-2 focus:outline-none"
        >
          <option value="">All channels</option>
          <option value="messenger">Messenger</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">{total.toLocaleString()} voice messages</p>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : data?.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Mic className="size-12 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No voice messages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Voice messages will appear here once customers send audio or Fish Audio is enabled.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.rows.map((msg: any) => (
            <VoiceCard key={msg.id} msg={msg} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > (data?.size ?? 30) && (
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} / {maxPage + 1}</span>
          <Button variant="outline" size="sm" disabled={page >= maxPage}
            onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function VoiceCard({ msg }: { msg: any }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const meta = msg.metadata ?? {};
  const audioUrl = meta.audioUrl ?? meta.audio_url ?? null;
  const transcript = msg.content?.startsWith("[Customer sent") ? null : msg.content;
  const isAI = msg.role === "assistant";
  const isDraft = meta.is_draft === true;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="panel p-4 flex gap-4">
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center shrink-0",
        isAI ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
      )}>
        {isAI ? <Volume2 className="size-4" /> : <Mic className="size-4" />}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-bold uppercase", isAI ? "text-primary" : "text-muted-foreground")}>
              {isAI ? "AI Reply" : "Customer"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground capitalize">{msg.channel}</span>
            {isDraft && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">Draft</span>}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
          </span>
        </div>

        {transcript && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageSquare className="size-3.5 mt-0.5 shrink-0" />
            <p className="text-xs leading-relaxed">{transcript}</p>
          </div>
        )}

        {audioUrl ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={togglePlay} className="gap-1.5 h-8">
              <Volume2 className={cn("size-3.5", playing && "text-primary animate-pulse")} />
              {playing ? "Pause" : "Play"}
            </Button>
            <a href={audioUrl} download target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" className="gap-1.5 h-8">
                <Download className="size-3.5" /> Download
              </Button>
            </a>
            <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">No audio URL stored</p>
        )}

        {meta.quality_score !== undefined && (
          <p className="text-[10px] text-muted-foreground">Quality: <span className="font-bold text-foreground">{meta.quality_score}%</span></p>
        )}
      </div>
    </div>
  );
}
