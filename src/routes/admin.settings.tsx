import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAgentSettings, saveAgentSettings, getMyRole, testAiConnection } from "@/lib/console.functions";
import { useAuth } from "@/hooks/useAuth";
import { getSyncCredentials, updateSyncCredentials, getMetaCredentials, updateMetaCredentials } from "@/lib/settings.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Key, KeyRound, Save, Sparkles, MessageSquare, Info, ShieldCheck, Copy, AlertCircle, Terminal, Globe, Zap, Database as DbIcon, Cloud, Music, Server } from "lucide-react";
import { getExtraSettingsAdmin, updateExtraSettings } from "@/lib/extra-settings.functions";
import { testBackblazeConnection, testBosonConnection, testFishAudioConnection, testMimoTTSConnection, getB2BStatus } from "@/lib/b2b.functions";
import { useEffect, useState } from "react";
import { verifyMetaConnection, getMetaWebhookConfig } from "@/lib/meta.functions";
import { rotateSyncCredentials, rollbackSyncCredentials } from "@/lib/audit.functions";
import { toast } from "sonner";
import { AutoReplyToggle } from "@/components/auto-reply-toggle";
import { SettingsTabs } from "@/components/SettingsTabs";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const DEFAULT_MODEL = "qwen/qwen3.8-27b-free"; // OrcaRouter free default

// Suggestions only — the model field is free text so any provider's model
// can be used (routing is driven by AI Base URL + AI API Key + model).
const MODELS = [
  // ── OrcaRouter FREE (recommended) ────────────────────────────────────────
  { id: "qwen/qwen3.8-27b-free",          label: "Qwen 3.8 27B (OrcaRouter FREE)" },
  { id: "deepseek/deepseek-v4-flash-free", label: "DeepSeek V4 Flash (OrcaRouter FREE)" },
  { id: "tencent/hy3-free",               label: "HunyuanLarge 3 (OrcaRouter FREE)" },
  // ── OrcaRouter paid ────────────────────────────────────────────────────────
  { id: "orcarouter/fusion-mini",          label: "OrcaRouter Fusion Mini (low cost)" },
  { id: "orcarouter/fusion-flash",         label: "OrcaRouter Fusion Flash" },
  { id: "orcarouter/auto",                 label: "OrcaRouter Auto (smart routing)" },
  { id: "google/gemini-2.5-flash",         label: "Gemini 2.5 Flash" },
  { id: "google/gemini-3.5-flash",         label: "Gemini 3.5 Flash" },
  { id: "openai/gpt-4o-mini",              label: "GPT-4o Mini" },
  { id: "openai/gpt-4o",                   label: "GPT-4o" },
  { id: "anthropic/claude-haiku-4.5",      label: "Claude Haiku 4.5" },
  // ── Legacy ────────────────────────────────────────────────────────────────
  { id: "mimo-v2.5", label: "MiMo V2.5 (legacy)" },
  { id: "glm-5.3",   label: "GLM 5.3 (Z.ai)" },
  { id: "deepseek-chat", label: "DeepSeek Chat (direct)" },
];

// Common OpenAI-compatible endpoints for quick reference
const AI_ENDPOINTS = [
  { label: "OrcaRouter (recommended)", url: "https://api.orcarouter.ai/v1" },
  { label: "MiMo (legacy)",               url: "https://api.xiaomimimo.com/v1" },
  { label: "OpenAI",                       url: "https://api.openai.com/v1" },
  { label: "DeepSeek",                     url: "https://api.deepseek.com/v1" },
  { label: "Z.ai (GLM)",                   url: "https://api.z.ai/api/paas/v4" },
  { label: "Google Gemini",                url: "https://generativelanguage.googleapis.com/v1beta/openai" },
];

// OrcaRouter preset — one-click configure (no key — loaded from server config)
const ORCA_PRESET = {
  url: "https://api.orcarouter.ai/v1",
  model: "qwen/qwen3.8-27b-free",
  key: "",
};

function MetaLoginButton({ metaAppId }: { metaAppId: string }) {
  const [status, setStatus] = useState<string>("unknown");
  const [user, setUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);

  const fetchPermissions = () => {
    // @ts-ignore
    if (typeof FB !== 'undefined') {
      // @ts-ignore
      FB.api('/me/permissions', (response: any) => {
        if (response && response.data) {
          setPermissions(response.data);
        }
      });
    }
  };

  useEffect(() => {
    const handleStatus = (e: any) => {
      setStatus(e.detail.status);
      if (e.detail.status === 'connected') {
        setUser(e.detail.authResponse);
        fetchPermissions();
      } else {
        setUser(null);
        setPermissions([]);
      }
    };
    window.addEventListener('fb-login-status', handleStatus);
    
    // Initial check if SDK already loaded
    // @ts-ignore
    if (typeof FB !== 'undefined' && FB.getLoginStatus) {
      // @ts-ignore
      FB.getLoginStatus((res) => handleStatus({ detail: res }));
    }

    return () => window.removeEventListener('fb-login-status', handleStatus);
  }, []);

  const handleLogin = (rerequest = false) => {
    // @ts-ignore
    if (typeof FB !== 'undefined') {
      const loginOptions: any = { 
        scope: 'pages_messaging,whatsapp_business_messaging,pages_manage_metadata,pages_read_engagement,email' 
      };
      
      if (rerequest) {
        loginOptions.auth_type = 'rerequest';
      }

      // @ts-ignore
      FB.login((response) => {
        setStatus(response.status);
        if (response.status === 'connected') {
          setUser(response.authResponse);
          fetchPermissions();
          toast.success(rerequest ? "পারমিশন রিকোয়েস্ট সফল হয়েছে" : "Meta লগইন সফল হয়েছে");
        }
      }, loginOptions);
    }
  };

  const handleLogout = () => {
    // @ts-ignore
    FB.logout((response) => {
      setStatus(response.status);
      setUser(null);
      setPermissions([]);
      toast.info("Meta লগআউট করা হয়েছে");
    });
  };

  const declinedPermissions = permissions.filter(p => p.status === 'declined');
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl bg-primary/5 border border-primary/10 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`size-3 rounded-full ${status === 'connected' ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <div>
            <p className="text-sm font-bold">Meta কানেকশন স্ট্যাটাস</p>
            <p className="text-xs text-muted-foreground">
              {status === 'connected' ? `কানেক্টেড (ID: ${user?.userID})` : 
               status === 'not_authorized' ? 'অ্যাপ অনুমোদিত নয়' : 'লগইন করা নেই'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {status === 'connected' ? (
            <Button variant="outline" size="sm" onClick={handleLogout} className="h-8">
              লগআউট
            </Button>
          ) : (
            <Button size="sm" onClick={() => handleLogin()} className="h-8 bg-[#1877F2] hover:bg-[#1877F2]/90">
              <Globe className="mr-2 size-4" />
              Meta লগইন
            </Button>
          )}
        </div>
      </div>

      {status === 'connected' && (
        <div className="space-y-3 pt-3 border-t border-border/30">
          <div className="flex flex-wrap gap-2">
            {permissions.map((p, i) => (
              <div 
                key={i} 
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  p.status === 'granted' ? 'bg-success/10 border-success/20 text-success' : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}
              >
                {p.permission}: {p.status}
              </div>
            ))}
          </div>
          
          {declinedPermissions.length > 0 && (
            <div className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/10">
              <p className="text-[10px] text-destructive italic">
                কিছু পারমিশন রিজেক্ট করা হয়েছে। ফুল ফিচারের জন্য এগুলো প্রয়োজন।
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] hover:bg-destructive/10 text-destructive"
                onClick={() => handleLogin(true)}
              >
                আবার রিকোয়েস্ট করুন
              </Button>
            </div>
          )}

          <div className="text-[9px] font-mono text-muted-foreground bg-background/50 p-2 rounded border border-border/30 overflow-x-auto">
            Token: {showToken ? user?.accessToken : "••••••••••••••••••••••••••••••"} <button type="button" onClick={() => setShowToken(!showToken)} className="text-primary ml-1 text-[9px] hover:underline">{showToken ? "Hide" : "Show"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const fetchSettings = useServerFn(getAgentSettings);
  const save = useServerFn(saveAgentSettings);
  
  const fetchExtra = useServerFn(getExtraSettingsAdmin);
  const saveExtra = useServerFn(updateExtraSettings);
  const fetchMyRole = useServerFn(getMyRole);

  const { data: roleData } = useQuery({ queryKey: ["my-role", session?.user.id], queryFn: () => fetchMyRole(), enabled: !!session });
  const isAdmin = roleData?.role === 'admin';

  const { data } = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("mimo-v2.5");
  const [autoApprove, setAutoApprove] = useState(false);
  const [apiKeyOverride, setApiKeyOverride] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [b2bBackblazeKey, setB2bBackblazeKey] = useState("");
  const [bosonWorkspaceId, setBosonWorkspaceId] = useState("");
  const [fishAudioApiKey, setFishAudioApiKey] = useState("");
  const [fishAudioModelId, setFishAudioModelId] = useState("");
  const [voiceProvider, setVoiceProvider] = useState<"fish" | "mimo" | "gemini">("gemini");
  const [altApiKeys, setAltApiKeys] = useState<Record<string, string>>({});
  const [adminPin, setAdminPin] = useState("856777");
  const [pinEnabled, setPinEnabled] = useState(true);
  const [bytezApiKey, setBytezApiKey] = useState("");
  const [b2bTestResults, setB2bTestResults] = useState<Record<string, { ok: boolean; data?: any; error?: string }>>({});

  const testAi = useServerFn(testAiConnection);
  const testBackblaze = useServerFn(testBackblazeConnection);
  const testBoson = useServerFn(testBosonConnection);
  const testFishAudio = useServerFn(testFishAudioConnection);
  const testMimoTTS = useServerFn(testMimoTTSConnection);
  const fetchB2BStatus = useServerFn(getB2BStatus);

  const { data: b2bStatus } = useQuery({ queryKey: ["b2b-status"], queryFn: () => fetchB2BStatus() });

  const b2bTestMutation = useMutation({
    mutationFn: async (service: string) => {
      switch (service) {
        case "backblaze": return testBackblaze();
        case "boson": return testBoson();
        case "fish_audio": return testFishAudio();
        case "mimo_tts": return testMimoTTS();
        default: throw new Error("Unknown service");
      }
    },
    onSuccess: (res: any, service) => {
      setB2bTestResults(prev => ({ ...prev, [service]: res }));
      if (res.ok) toast.success(`${service} connection successful`);
      else toast.error(res.error || `${service} connection failed`);
    },
    onError: (err: any, service) => {
      setB2bTestResults(prev => ({ ...prev, [service]: { ok: false, error: err.message } }));
      toast.error(`${service} test failed`);
    },
  });
  const [vpsConfig, setVpsConfig] = useState<any>({});
  const [telegramBotToken, setTelegramBotToken] = useState("");

  const [syncToken, setSyncToken] = useState("");
  const [syncSecret, setSyncSecret] = useState("");

  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaPageId, setMetaPageId] = useState("");
  const [metaWhatsappId, setMetaWhatsappId] = useState("");
  const [metaVerifyToken, setMetaVerifyToken] = useState("");
  const [metaApiVersion, setMetaApiVersion] = useState("v19.0");

  const fetchSyncCreds = useServerFn(getSyncCredentials);
  const saveSyncCreds = useServerFn(updateSyncCredentials);
  const fetchMetaCreds = useServerFn(getMetaCredentials);
  const saveMetaCreds = useServerFn(updateMetaCredentials);
  const verifyMeta = useServerFn(verifyMetaConnection);
  const getWebhookConfig = useServerFn(getMetaWebhookConfig);

  const { data: extraData } = useQuery({ queryKey: ["extra-settings"], queryFn: () => fetchExtra() });
  const { data: syncData } = useQuery({ queryKey: ["sync-credentials"], queryFn: () => fetchSyncCreds() });
  const { data: metaData } = useQuery({ queryKey: ["meta-credentials"], queryFn: () => fetchMetaCreds() });
  const { data: webhookConfig } = useQuery({ queryKey: ["meta-webhook-config"], queryFn: () => getWebhookConfig() });

  useEffect(() => {
    if (metaData) {
      setMetaAppId(metaData.appId || "");
      setMetaAppSecret(metaData.appSecret || "");
      setMetaAccessToken(metaData.accessToken || "");
      setMetaPageId(metaData.pageId || "");
      setMetaWhatsappId(metaData.whatsappId || "");
      setMetaVerifyToken(metaData.verifyToken || "");
      setMetaApiVersion((metaData as any).apiVersion || "v19.0");
    }
  }, [metaData]);

  useEffect(() => {
    if (syncData) {
      setSyncToken(syncData.token || "");
      setSyncSecret(syncData.secret || "");
    }
  }, [syncData]);

  useEffect(() => {
    if (!extraData) return;
    setReduceMotion(extraData.reduceMotion);
    setB2bBackblazeKey(extraData.b2bBackblazeKey);
    setBosonWorkspaceId(extraData.bosonWorkspaceId);
    setFishAudioApiKey(extraData.fishAudioApiKey);
    setFishAudioModelId(extraData.fishAudioModelId || "");
    setVoiceProvider(extraData.voiceProvider || "fish");
    setAltApiKeys(extraData.altApiKeys);
    setVpsConfig(extraData.vpsHostingConfig);
    if (extraData.adminPin) setAdminPin(extraData.adminPin);
    if (extraData.pinEnabled !== undefined) setPinEnabled(extraData.pinEnabled);
    if (extraData.bytezApiKey) setBytezApiKey(extraData.bytezApiKey);
  }, [extraData]);

  useEffect(() => {
    if (!data) return;
    setPrompt(data.system_prompt ?? "");
    setModel(data.model || DEFAULT_MODEL);
    setAutoApprove(Boolean(data.auto_approve));
    setApiKeyOverride(data.ai_api_key ?? "");
    setAiBaseUrl(data.ai_base_url ?? "");
    setTelegramBotToken((data as any).telegram_bot_token ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: {
        system_prompt: prompt,
        model,
        auto_approve: autoApprove,
        ai_api_key: apiKeyOverride,
        ai_base_url: aiBaseUrl,
        telegram_bot_token: telegramBotToken
      } }).then(() => saveExtra({ data: {
        reduceMotion,
        b2bBackblazeKey,
        bosonWorkspaceId,
        fishAudioApiKey,
        fishAudioModelId,
        voiceProvider,
        altApiKeys,
        vpsHostingConfig: vpsConfig,
        adminPin,
        pinEnabled,
        bytezApiKey,
      } })),
    onSuccess: () => {
      toast.success("সেটিংস সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
      qc.invalidateQueries({ queryKey: ["extra-settings"] });
    },
    onError: () => toast.error("সেভ করা যায়নি।"),
  });

  const updateCredsMutation = useMutation({
    mutationFn: () => saveSyncCreds({ data: { token: syncToken, secret: syncSecret } }),
    onSuccess: () => {
      toast.success("সিঙ্ক ক্রেডেনশিয়াল সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["sync-credentials"] });
    },
    onError: (err: any) => toast.error(err.message || "সেভ করা যায়নি।"),
  });

  const updateMetaMutation = useMutation({
    mutationFn: () => saveMetaCreds({ 
      data: { 
        appId: metaAppId, 
        appSecret: metaAppSecret, 
        accessToken: metaAccessToken,
        pageId: metaPageId,
        whatsappId: metaWhatsappId,
        verifyToken: metaVerifyToken,
        apiVersion: metaApiVersion
      } 
    }),
    onSuccess: () => {
      toast.success("Meta ক্রেডেনশিয়াল সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["meta-credentials"] });
    },
    onError: (err: any) => toast.error(err.message || "সেভ করা যায়নি।"),
  });

  const verifyMetaMutation = useMutation({
    mutationFn: () => verifyMeta(),
    onSuccess: (data: any) => {
      toast.success(`কানেকশন সফল! পেজ: ${data.pageName}`);
    },
    onError: (err: any) => toast.error(err.message || "ভেরিফিকেশন ব্যর্থ হয়েছে।"),
  });

  const rotateSyncMutation = useMutation({
    mutationFn: () => useServerFn(rotateSyncCredentials)(),
    onSuccess: () => toast.success("ক্রেডেনশিয়াল রোটেট হয়েছে"),
  });

  const rollbackSyncMutation = useMutation({
    mutationFn: (creds: { token: string, secret: string }) => useServerFn(rollbackSyncCredentials)({ data: creds }),
    onSuccess: () => {
      toast.success("রোলব্যাক সফল হয়েছে");
      qc.invalidateQueries({ queryKey: ["sync-credentials"] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">সেটিংস</h1>
          <p className="mt-1 text-sm text-muted-foreground italic">Daddy AI-এর ব্যক্তিত্ব ও নিয়মাবলী কনফিগার করুন।</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/logs">
              <Terminal className="mr-2 size-4" />
              Logs & Policy
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/api-keys">
              <KeyRound className="mr-2 size-4" />
              API Keys
            </Link>
          </Button>
          <Button 
            size="lg" 
            onClick={() => mutation.mutate()} 
            disabled={mutation.isPending}
            className="shadow-xl shadow-primary/20"
          >
            <Save className="mr-2 size-4" />
            {mutation.isPending ? "সেভ হচ্ছে..." : "সব সেটিংস সেভ করুন"}
          </Button>
        </div>
      </div>

      <SettingsTabs />

      <div className="panel p-8 bg-card/40 backdrop-blur-sm border-border/30 shadow-2xl mb-8 border-red-500/30 ring-1 ring-red-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <KeyRound className="size-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">সিঙ্ক ক্রেডেনশিয়াল রোটেশন (Secret Rotation)</h2>
              <p className="text-[10px] text-red-400 mt-1 font-semibold">Warning: This action invalidates old tokens.</p>
              <p className="text-xs text-muted-foreground italic">নিরাপত্তার জন্য নিয়মিত Webhook Secret এবং API Token পরিবর্তন করুন।</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                if (confirm("আপনি কি নিশ্চিতভাবে ক্রেডেনশিয়াল রোলব্যাক করতে চান?")) {
                  const old = JSON.parse(localStorage.getItem('prev_sync_creds') || '{}');
                  if (!old.token) {
                    toast.error("কোন ব্যাকআপ পাওয়া যায়নি");
                    return;
                  }
                  await rollbackSyncMutation.mutateAsync(old);
                }
              }}
 className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" >
              রোলব্যাক (Rollback)
            </Button>
            <Button 
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
              onClick={async () => {
                if (confirm("ক্রেডেনশিয়াল রোটেশন করলে পুরাতন টোকেনগুলো আর কাজ করবে না। চালিয়ে যেতে চান?")) {
                  const res = await rotateSyncMutation.mutateAsync();
                  localStorage.setItem('prev_sync_creds', JSON.stringify({ token: syncToken, secret: syncSecret }));
                  setSyncToken(res.token);
                  setSyncSecret(res.secret);
                  return;
                }
              }}
            >
              নতুন ক্রেডেনশিয়াল জেনারেট করুন
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-border/30 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-lg font-bold">এজেন্ট ইনস্ট্রাকশন (System Prompt)</h2>
            </div>
            <Textarea
              id="prompt"
              rows={12}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-sm leading-relaxed bg-muted/20 border-border/30 focus:bg-background transition-all focus:ring-1 focus:ring-primary/50"
              placeholder="আপনি একজন দক্ষ সেলস এজেন্ট..."
            />
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
              <Sparkles className="size-3 mt-0.5 text-primary shrink-0" />
              <span>
                <strong>টিপস:</strong> আপনি এখানে এজেন্টের টোন, কথা বলার ভাষা (বাংলা/ইংরেজি), এবং কী কী তথ্য শেয়ার করা যাবে তা নির্দিষ্ট করতে পারেন।
              </span>
            </p>
          </div>

          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-border/30 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Auto-Reply Mode</h2>
            </div>
            <AutoReplyToggle currentMode={extraData?.autoReplyMode || 'off'} />
          </div>

          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-border/30 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Cloud className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">B2B & External Services</h2>
                {b2bStatus && (
                  <div className="flex gap-1 ml-2">
                    {b2bStatus.backblaze?.configured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">B2</span>}
                    {b2bStatus.fishAudio?.configured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">Fish</span>}
                    {b2bStatus.mimoTTS?.configured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">MiMo</span>}
                    {b2bStatus.boson?.configured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">Boson</span>}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  for (const svc of ["backblaze", "fish_audio", "mimo_tts", "boson"]) {
                    await b2bTestMutation.mutateAsync(svc).catch(() => {});
                  }
                }}
                disabled={b2bTestMutation.isPending}
                className="h-8 text-xs"
              >
                {b2bTestMutation.isPending ? "Testing..." : "Test All"}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Backblaze B2 Key</Label>
                  <div className="flex items-center gap-1">
                    {b2bTestResults.backblaze && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${b2bTestResults.backblaze.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {b2bTestResults.backblaze.ok ? `Connected (${b2bTestResults.backblaze.data?.buckets} buckets)` : 'Failed'}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => b2bTestMutation.mutate("backblaze")} disabled={b2bTestMutation.isPending}>
                      Test
                    </Button>
                  </div>
                </div>
                <Input
                  type="password"
                  placeholder={extraData?.b2bBackblazeKey ? "••••••••" : "API Key"}
                  value={b2bBackblazeKey}
                  onChange={(e) => setB2bBackblazeKey(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Boson Workspace ID</Label>
                  <div className="flex items-center gap-1">
                    {b2bTestResults.boson && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${b2bTestResults.boson.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {b2bTestResults.boson.ok ? 'Connected' : 'Failed'}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => b2bTestMutation.mutate("boson")} disabled={b2bTestMutation.isPending}>
                      Test
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="ID"
                  value={bosonWorkspaceId}
                  onChange={(e) => setBosonWorkspaceId(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Voice Provider</Label>
                <select
                  value={voiceProvider}
                  onChange={(e) => setVoiceProvider(e.target.value as "fish" | "mimo" | "gemini")}
                  className="w-full rounded-md border border-border/30 bg-muted/20 px-3 py-2 text-sm font-mono focus:bg-background"
                >
                  <option value="fish">Fish Audio (Voice Cloning)</option>
                  <option value="mimo">MiMo TTS (Xiaomi)</option>
                  <option value="gemini">Gemini TTS (Free)</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Fish Audio API Key</Label>
                  <div className="flex items-center gap-1">
                    {b2bTestResults.fish_audio && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${b2bTestResults.fish_audio.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {b2bTestResults.fish_audio.ok ? `Connected (${b2bTestResults.fish_audio.data?.models} models)` : 'Failed'}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => b2bTestMutation.mutate("fish_audio")} disabled={b2bTestMutation.isPending}>
                      Test
                    </Button>
                  </div>
                </div>
                <Input
                  type="password"
                  placeholder={extraData?.fishAudioApiKey ? "••••••••" : "API Key"}
                  value={fishAudioApiKey}
                  onChange={(e) => setFishAudioApiKey(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Fish Audio Model / Voice ID</Label>
                <Input
                  placeholder="Voice model ID (leave empty for default)"
                  value={fishAudioModelId}
                  onChange={(e) => setFishAudioModelId(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
                <p className="text-[10px] text-muted-foreground/50">Paste a Fish Audio voice model ID for voice cloning</p>
              </div>
              {/* DigitalOcean Inference Key — used for Vision AI (openai-gpt-4o) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    DigitalOcean Inference Key
                  </Label>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Vision AI</span>
                </div>
                <Input
                  type="password"
                  placeholder={altApiKeys?.do_inference_key ? "••••••••" : "DO Inference API key"}
                  value={altApiKeys?.do_inference_key ?? ""}
                  onChange={(e) => setAltApiKeys({ ...altApiKeys, do_inference_key: e.target.value })}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  Used for image analysis via <span className="text-blue-400 font-mono">kimi-k3</span> on DigitalOcean Gradient AI (DO-hosted, no OpenAI subscription needed).
                  Get your key at <span className="text-blue-400">cloud.digitalocean.com → AI → Model Access Keys</span>
                </p>
              </div>

              {/* ── Bytez API Key ────────────────────────────── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    Bytez API Key
                  </Label>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">Vision · ASR · TTS · Chat Fallback</span>
                </div>
                <Input
                  type="password"
                  placeholder={extraData?.bytezApiKey ? "••••••••" : "Bytez API Key (f7c0...)"}
                  value={bytezApiKey}
                  onChange={(e) => setBytezApiKey(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  Free open-source AI fallback for vision, transcription, TTS, and text. Get your key at{" "}
                  <a href="https://bytez.com/api" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">bytez.com/api</a>.
                  100,000+ models — used when primary providers fail.
                </p>
              </div>

              {/* ── Admin PIN Lock ───────────────────────────── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">
                    Admin PIN Lock
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Enabled</span>
                    <button
                      type="button"
                      onClick={() => setPinEnabled(!pinEnabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pinEnabled ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${pinEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
                <Input
                  type="password"
                  placeholder="6-digit PIN (e.g. 856777)"
                  value={adminPin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setAdminPin(v);
                  }}
                  maxLength={6}
                  inputMode="numeric"
                  className="bg-muted/20 border-border/30 font-mono text-sm tracking-[0.5em] focus:bg-background"
                  disabled={!pinEnabled}
                />
                <p className="text-[10px] text-muted-foreground/50">
                  6-digit PIN shown on admin panel load. Biometric (Face ID / fingerprint) also supported where available. Session lasts 4 hours.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">VPS Hosting Server URL</Label>
                <Input
                  placeholder="https://..."
                  value={vpsConfig?.serverUrl || ""}
                  onChange={(e) => setVpsConfig({ ...vpsConfig, serverUrl: e.target.value })}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-border/30">
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="h-9 text-xs font-semibold"
              >
                <Save className="mr-2 size-3" />
                {mutation.isPending ? "সেভ হচ্ছে..." : "B2B সেটিংস সেভ করুন"}
              </Button>
            </div>
          </div>


          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-border/30 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Key className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">API সিঙ্ক ক্রেডেনশিয়াল</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => updateCredsMutation.mutate()}
                disabled={updateCredsMutation.isPending}
                className="h-8 text-xs font-semibold"
              >
                {updateCredsMutation.isPending ? "সেভ হচ্ছে..." : "ক্রেডেনশিয়াল আপডেট করুন"}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Sync Token</Label>
                <Input
                  type="password"
                  placeholder={syncData?.token ? "••••••••" : "ব্যাকএন্ড টোকেন দিন"}
                  value={syncToken}
                  onChange={(e) => setSyncToken(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Sync Secret</Label>
                <Input
                  type="password"
                  placeholder={syncData?.secret ? "••••••••" : "ব্যাকএন্ড সিক্রেট দিন"}
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground bg-primary/5 p-3 rounded-md border border-primary/10">
              নিরাপত্তার স্বার্থে টোকেন এবং সিক্রেট মাস্ক করে দেখানো হচ্ছে। নতুন মান সেভ করলে আগেরগুলো ওভাররাইট হবে।
            </p>
          </div>
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-border/30 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-[#1877F2]" />
                <h2 className="text-lg font-bold tracking-tight">Meta বিজনেস কানেকশন</h2>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => verifyMetaMutation.mutate()}
                  disabled={verifyMetaMutation.isPending || !metaPageId || !metaAccessToken}
                  className="h-8 text-xs font-semibold"
                >
                  {verifyMetaMutation.isPending ? "ভেরিফাই হচ্ছে..." : "কানেকশন টেস্ট"}
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => updateMetaMutation.mutate()}
                  disabled={updateMetaMutation.isPending}
                  className="h-8 text-xs font-semibold"
                >
                  {updateMetaMutation.isPending ? "সেভ হচ্ছে..." : "Meta আপডেট করুন"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-full mb-4">
                <MetaLoginButton metaAppId={metaAppId} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">App ID</Label>
                <Input
                  placeholder="Meta App ID"
                  value={metaAppId}
                  onChange={(e) => setMetaAppId(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">App Secret</Label>
                <Input
                  type="password"
                  placeholder={metaData?.appSecret ? "••••••••" : "Meta App Secret"}
                  value={metaAppSecret}
                  onChange={(e) => setMetaAppSecret(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Page ID</Label>
                <Input
                  placeholder="Facebook Page ID"
                  value={metaPageId}
                  onChange={(e) => setMetaPageId(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">WhatsApp ID (Optional)</Label>
                <Input
                  placeholder="WhatsApp Business Account ID"
                  value={metaWhatsappId}
                  onChange={(e) => setMetaWhatsappId(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">API Version</Label>
                <Input
                  placeholder="v19.0"
                  value={metaApiVersion}
                  onChange={(e) => setMetaApiVersion(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background disabled:opacity-50"
                />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">System User Access Token</Label>
                <Input
                  type="password"
                  placeholder={metaData?.accessToken ? "••••••••" : "Meta Access Token (Never Expires)"}
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  disabled={!isAdmin}
                  className="bg-muted/20 border-border/30 font-mono text-sm focus:bg-background disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                  <ShieldCheck className="size-4 text-primary" />
                  Meta Client OAuth & Webhook সেটিংস
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded bg-background/50 border border-border/30 space-y-2">
                      <p className="font-bold text-primary italic">Client OAuth Settings</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Standard OAuth: Enabled</li>
                        <li>Web OAuth Login: Enabled</li>
                        <li>Enforce HTTPS: Yes (Required)</li>
                        <li>Strict Mode: Enabled</li>
                      </ul>
                    </div>
                    <div className="p-3 rounded bg-background/50 border border-border/30 space-y-2">
                      <p className="font-bold text-primary italic">JavaScript SDK Settings</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Login with JS SDK: Enabled</li>
                        <li>Allowed Domains: <code>{typeof window !== 'undefined' ? window.location.hostname : ''}</code></li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Valid OAuth Redirect URIs:</span>
                        <span className="text-[10px] text-accent italic font-bold">Popups & In-app Browsers</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-primary font-mono truncate">{`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}</code>
                        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/auth/callback`);
                          toast.success("Redirect URI কপি করা হয়েছে");
                        }}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <p className="text-[9px] text-muted-foreground/60 leading-tight">
                        A manually specified redirect_uri used with Login on the web must exactly match this URI.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-border/30">
                      <span className="text-muted-foreground font-medium">Allowed Domains for the JavaScript SDK:</span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-primary font-mono truncate">{typeof window !== 'undefined' ? window.location.hostname : ''}</code>
                        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
                          navigator.clipboard.writeText(window.location.hostname);
                          toast.success("Domain কপি করা হয়েছে");
                        }}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Deauthorize / Data Deletion Callback:</span>
                        <span className="text-[10px] text-destructive italic font-bold">Security & Privacy</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-primary font-mono truncate">{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/meta/deletion`}</code>
                        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/public/meta/deletion`);
                          toast.success("Callback URL কপি করা হয়েছে");
                        }}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <p className="text-[9px] text-muted-foreground/60 leading-tight">
                        Webhook Meta pings when a user deauthorizes the app or requests data deletion.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-border/30">
                      <span className="text-muted-foreground font-medium">Data Deletion Request URL (User Facing):</span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-primary font-mono truncate">https://salesdaddy.netlify.app/data-policy</code>
                        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
                          navigator.clipboard.writeText("https://salesdaddy.netlify.app/data-policy");
                          toast.success("Policy URL কপি করা হয়েছে");
                        }}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-border/30">
                      <span className="text-muted-foreground font-medium">Webhook Callback URL:</span>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-primary font-mono truncate">{webhookConfig?.callbackUrl || "..."}</code>
                        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
                          navigator.clipboard.writeText(webhookConfig?.callbackUrl || "");
                          toast.success("Callback URL কপি করা হয়েছে");
                        }}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-background/40 border border-border/30">
                      <span className="text-muted-foreground font-medium">Verify Token:</span>
                      <Input 
                        className="h-7 w-48 text-[10px] bg-background/50 border-border/30"
                        value={metaVerifyToken}
                        onChange={(e) => setMetaVerifyToken(e.target.value)}
                        placeholder="আপনার ভেরিফাই টোকেন"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  {/* Meta Business ID */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div>
                      <p className="text-sm font-medium">Meta Business ID</p>
                      <p className="text-xs text-muted-foreground">Partner Integration Config ID</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-background rounded border border-border/30 text-xs font-mono text-primary">
                        4435001526812234
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8"
                        onClick={() => {
                          navigator.clipboard.writeText("4435001526812234");
                          toast.success("Business ID কপি করা হয়েছে");
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Instagram Marketplace ID */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-pink-500/5 border border-pink-500/10">
                    <div>
                      <p className="text-sm font-medium">Instagram Marketplace ID</p>
                      <p className="text-xs text-muted-foreground">Creator Marketplace Config ID</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-background rounded border border-border/30 text-xs font-mono text-pink-500">
                        1065823475931849
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8"
                        onClick={() => {
                          navigator.clipboard.writeText("1065823475931849");
                          toast.success("Instagram ID কপি করা হয়েছে");
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Instagram Onboarding ID */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                    <div>
                      <p className="text-sm font-medium">Instagram Onboarding ID</p>
                      <p className="text-xs text-muted-foreground">App Onboarding Config ID</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-background rounded border border-border/30 text-xs font-mono text-indigo-400">
                        1687781608963502
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8"
                        onClick={() => {
                          navigator.clipboard.writeText("1687781608963502");
                          toast.success("Onboarding ID কপি করা হয়েছে");
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* WhatsApp Measurement Partner ID */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <div>
                      <p className="text-sm font-medium">WhatsApp Measurement Partner</p>
                      <p className="text-xs text-muted-foreground">Measurement Partner Config ID</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-background rounded border border-border/30 text-xs font-mono text-emerald-400">
                        1069878039319399
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8"
                        onClick={() => {
                          navigator.clipboard.writeText("1069878039319399");
                          toast.success("WhatsApp ID কপি করা হয়েছে");
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* WhatsApp Embedded Signup ID */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-600/5 border border-emerald-600/10">
                    <div>
                      <p className="text-sm font-medium">WhatsApp Embedded Signup</p>
                      <p className="text-xs text-muted-foreground">Embedded Signup (60d Token) ID</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-background rounded border border-border/30 text-xs font-mono text-emerald-500">
                        1627789222122323
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8"
                        onClick={() => {
                          navigator.clipboard.writeText("1627789222122323");
                          toast.success("Embedded Signup ID কপি করা হয়েছে");
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-yellow-500 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-yellow-500">App Review ও বিজনেস ভেরিফিকেশন</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        আপনার অ্যাপটি লাইভ করার আগে Meta App Review সম্পন্ন করতে হবে। অন্যথায় আপনার রোলের বাইরের ইউজাররা এটি ব্যবহার করতে পারবে না। 
                        <a href="https://developers.facebook.com/docs/apps/business-verification" target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">
                          বিজনেস ভেরিফিকেশন গাইড দেখুন →
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/5 border border-accent/10">
                <Info className="size-4 text-accent shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-accent mb-1">প্রয়োজনীয় পারমিশন:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><code>pages_messaging</code>, <code>whatsapp_business_messaging</code></li>
                    <li><code>pages_manage_metadata</code>, <code>pages_read_engagement</code></li>
                  </ul>
                  <a 
                    href="https://developers.facebook.com/docs/messenger-platform/getting-started" 
                    target="_blank" 
                    rel="noreferrer"
                    className="mt-2 inline-block text-primary hover:underline font-bold"
                  >
                    Meta ডেভেলপার গাইড দেখুন →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6 bg-card/60 backdrop-blur-sm border-border/30">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI ইঞ্জিন
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">মডেল (Model ID)</Label>
                <Input
                  list="ai-model-suggestions"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="glm-5.3"
                  className="bg-background/50 border-border/30 font-mono"
                />
                <datalist id="ai-model-suggestions">
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  যেকোনো প্রোভাইডারের মডেল লিখুন (যেমন glm-5.3, mimo-v2.5, gpt-4o-mini)। নিচের Base URL ও API Key অনুযায়ী রাউট হবে।
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">AI Base URL (OpenAI-compatible)</Label>
                <Input
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.z.ai/api/paas/v4"
                  className="bg-background/50 border-border/30 font-mono"
                />
                {/* OrcaRouter quick-setup banner */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 mb-2">
                  <span className="text-lg"><Zap size={18} className="text-primary" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-primary">OrcaRouter — 191 models, FREE tier available</p>
                    <p className="text-[10px] text-muted-foreground truncate">qwen/qwen3.8-27b-free · deepseek/deepseek-v4-flash-free · and more</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiBaseUrl(ORCA_PRESET.url);
                      setModel(ORCA_PRESET.model);
                      setApiKeyOverride(ORCA_PRESET.key);
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wide hover:bg-primary/90 transition-colors"
                  >
                    One-click Setup
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AI_ENDPOINTS.map((ep) => (
                    <button
                      key={ep.url}
                      type="button"
                      onClick={() => setAiBaseUrl(ep.url)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border/30 bg-background/40 hover:bg-background/70 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {ep.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">OrcaRouter ব্যবহার করুন — <span className="text-primary font-semibold">191টি মডেল, FREE tier সহ</span>।</p>

                {/* Self-Hosted AI Presets */}
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Server className="size-3.5" /> Self-Hosted AI / VPS Presets
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Ollama (Local)", url: "http://localhost:11434/v1", model: "llama3.1" },
                      { label: "Ollama (VPS)", url: "http://YOUR_VPS_IP:11434/v1", model: "llama3.1" },
                      { label: "vLLM", url: "http://localhost:8000/v1", model: "meta-llama/Llama-3.1-8B-Instruct" },
                      { label: "LocalAI", url: "http://localhost:8080/v1", model: "gpt-4" },
                      { label: "text-generation-webui", url: "http://localhost:5000/v1", model: "default" },
                      { label: "LM Studio", url: "http://localhost:1234/v1", model: "local-model" },
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => {
                          setAiBaseUrl(preset.url);
                          setModel(preset.model);
                        }}
                        className="text-xs px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    আপনার নিজের VPS বা লোকাল মেশিনে AI হোস্ট করুন। Base URL ও Model অটো-সেট হবে।
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">AI API Key (যেকোনো প্রোভাইডার)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-orca-... / sk-... / zai-..."
                  value={apiKeyOverride}
                  onChange={(e) => setApiKeyOverride(e.target.value)}
                  className="bg-background/50 border-border/30"
                />
                <p className="text-xs text-muted-foreground">
                  খালি রাখলে সার্ভারের ORCA_API_KEY বা MIMO_API_KEY ব্যবহৃত হবে।
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiTesting || !model}
                  onClick={async () => {
                    setAiTesting(true);
                    setAiTestResult(null);
                    try {
                      const res = await testAi({ data: { ai_base_url: aiBaseUrl,
        telegram_bot_token: telegramBotToken || undefined, ai_api_key: apiKeyOverride || undefined, model } });
                      setAiTestResult({ ok: res.ok, error: res.error });
                      if (res.ok) toast.success(`AI কানেকশন ঠিক আছে (${res.model})`);
                      else toast.error("AI কানেকশন ব্যর্থ");
                    } catch (err: any) {
                      setAiTestResult({ ok: false, error: err?.message || String(err) });
                      toast.error("AI কানেকশন ব্যর্থ");
                    } finally {
                      setAiTesting(false);
                    }
                  }}
                >
                  {aiTesting ? "টেস্ট হচ্ছে..." : "কানেকশন টেস্ট করুন"}
                </Button>
                {aiTestResult && (
                  <span className={`text-xs ${aiTestResult.ok ? "text-green-500" : "text-red-500"}`}>
                    {aiTestResult.ok
                      ? `সফল (${model})`
                      : `ব্যর্থ: ${aiTestResult.error || "অজানা সমস্যা"}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="panel p-6 border-l-4 border-l-accent bg-accent/5 backdrop-blur-sm">
            <h2 className="font-bold mb-4">অটোমেশন</h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">অটো-অ্যাপ্রুভ</p>
                <p className="text-xs text-muted-foreground">
                  নতুন ডেটা সরাসরি ট্রেনিংয়ে যাবে।
                </p>
              </div>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>
          </div>

          
          {/* Telegram Bot Configuration */}
          <div className="panel p-6 bg-card/60 backdrop-blur-sm border-border/30">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Globe className="size-4 text-sky-400" />
              Telegram Bot
            </h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Bot Token</Label>
                <Input
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="bg-background/50 border-border/30 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  @BotFather থেকে টোকেন নিন। সেট করলে Telegram থেকে মেসেজ আসলে AI রিপ্লাই দেবে।
                </p>
              </div>
              {telegramBotToken && (
                <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20">
                  <p className="text-xs text-sky-400 font-bold mb-1">Webhook URL</p>
                  <code className="text-xs font-mono text-muted-foreground">https://daddyai.online/api/public/webhooks/telegram</code>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Telegram Bot API এ এই URL সেট করুন: <code>setWebhook</code> API দিয়ে।
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="panel p-6 border-l-4 border-l-primary bg-primary/5 backdrop-blur-sm">
            <h2 className="font-bold mb-4">কুইক লিংক</h2>
            <div className="space-y-3">
              <Link to="/admin/webhook-test">
                <Button variant="outline" size="sm" className="w-full justify-start border-border/30 hover:bg-white/5">
                  প্লাটফর্ম টেস্ট রান
                </Button>
              </Link>
              <Link to="/admin/sync">
                <Button variant="ghost" size="sm" className="w-full justify-start hover:bg-white/5">
                  সিঙ্ক স্ট্যাটাস লগ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
