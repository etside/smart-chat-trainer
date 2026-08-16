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
import { getAgentSettings, saveAgentSettings } from "@/lib/console.functions";
import { getSyncCredentials, updateSyncCredentials, getMetaCredentials, updateMetaCredentials } from "@/lib/settings.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Key, Save, Sparkles, Facebook, MessageSquare, Info, ShieldCheck, Copy, AlertCircle, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { verifyMetaConnection, getMetaWebhookConfig } from "@/lib/meta.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const MODELS = [
  { id: "openai/gpt-5.6-sol", label: "Daddy High-Performance (GPT-5.6 Sol)" },
  { id: "openai/gpt-5.6-terra", label: "Daddy Balanced (GPT-5.6 Terra)" },
  { id: "openai/gpt-5.6-luna", label: "Daddy Fast & Light (GPT-5.6 Luna)" },
];

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
              <Facebook className="mr-2 size-4" />
              Meta লগইন
            </Button>
          )}
        </div>
      </div>

      {status === 'connected' && (
        <div className="space-y-3 pt-3 border-t border-white/5">
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

          <div className="text-[9px] font-mono text-muted-foreground bg-background/50 p-2 rounded border border-white/5 overflow-x-auto">
            Token: {user?.accessToken.substring(0, 30)}...
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAgentSettings);
  const save = useServerFn(saveAgentSettings);

  const { data } = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-5.6-sol");
  const [autoApprove, setAutoApprove] = useState(false);
  const [apiKeyOverride, setApiKeyOverride] = useState("");

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
    if (!data) return;
    setPrompt(data.system_prompt ?? "");
    setModel(data.model ?? "openai/gpt-5.6-sol");
    setAutoApprove(Boolean(data.auto_approve));
    setApiKeyOverride(data.lovable_api_key_override ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { 
        system_prompt: prompt, 
        model, 
        auto_approve: autoApprove,
        lovable_api_key_override: apiKeyOverride
      } }),
    onSuccess: () => {
      toast.success("সেটিংস সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
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


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-lg font-bold">এজেন্ট ইনস্ট্রাকশন (System Prompt)</h2>
            </div>
            <Textarea
              id="prompt"
              rows={12}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-sm leading-relaxed bg-muted/20 border-white/5 focus:bg-background transition-all focus:ring-1 focus:ring-primary/50"
              placeholder="আপনি একজন দক্ষ সেলস এজেন্ট..."
            />
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
              <Sparkles className="size-3 mt-0.5 text-primary shrink-0" />
              <span>
                <strong>টিপস:</strong> আপনি এখানে এজেন্টের টোন, কথা বলার ভাষা (বাংলা/ইংরেজি), এবং কী কী তথ্য শেয়ার করা যাবে তা নির্দিষ্ট করতে পারেন।
              </span>
            </p>
          </div>

          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
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
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Sync Secret</Label>
                <Input
                  type="password"
                  placeholder={syncData?.secret ? "••••••••" : "ব্যাকএন্ড সিক্রেট দিন"}
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground bg-primary/5 p-3 rounded-md border border-primary/10">
              নিরাপত্তার স্বার্থে টোকেন এবং সিক্রেট মাস্ক করে দেখানো হচ্ছে। নতুন মান সেভ করলে আগেরগুলো ওভাররাইট হবে।
            </p>
          </div>
          <div className="panel p-8 bg-card/40 backdrop-blur-sm border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Facebook className="size-5 text-[#1877F2]" />
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
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">App Secret</Label>
                <Input
                  type="password"
                  placeholder={metaData?.appSecret ? "••••••••" : "Meta App Secret"}
                  value={metaAppSecret}
                  onChange={(e) => setMetaAppSecret(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Page ID</Label>
                <Input
                  placeholder="Facebook Page ID"
                  value={metaPageId}
                  onChange={(e) => setMetaPageId(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">WhatsApp ID (Optional)</Label>
                <Input
                  placeholder="WhatsApp Business Account ID"
                  value={metaWhatsappId}
                  onChange={(e) => setMetaWhatsappId(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">API Version</Label>
                <Input
                  placeholder="v19.0"
                  value={metaApiVersion}
                  onChange={(e) => setMetaApiVersion(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
                />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">System User Access Token</Label>
                <Input
                  type="password"
                  placeholder={metaData?.accessToken ? "••••••••" : "Meta Access Token (Never Expires)"}
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  className="bg-muted/20 border-white/5 font-mono text-sm focus:bg-background"
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
                    <div className="p-3 rounded bg-background/50 border border-white/5 space-y-2">
                      <p className="font-bold text-primary italic">Client OAuth Settings</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Standard OAuth: Enabled</li>
                        <li>Web OAuth Login: Enabled</li>
                        <li>Enforce HTTPS: Yes (Required)</li>
                        <li>Strict Mode: Enabled</li>
                      </ul>
                    </div>
                    <div className="p-3 rounded bg-background/50 border border-white/5 space-y-2">
                      <p className="font-bold text-primary italic">JavaScript SDK Settings</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Login with JS SDK: Enabled</li>
                        <li>Allowed Domains: <code>{typeof window !== 'undefined' ? window.location.hostname : ''}</code></li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-white/5">
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

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-white/5">
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

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-white/5">
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

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-white/5">
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

                    <div className="flex flex-col gap-1.5 p-2 rounded bg-background/40 border border-white/5">
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

                    <div className="flex items-center justify-between p-2 rounded bg-background/40 border border-white/5">
                      <span className="text-muted-foreground font-medium">Verify Token:</span>
                      <Input 
                        className="h-7 w-48 text-[10px] bg-background/50 border-white/10"
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
                      <code className="px-2 py-1 bg-background rounded border border-white/10 text-xs font-mono text-primary">
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
                      <code className="px-2 py-1 bg-background rounded border border-white/10 text-xs font-mono text-pink-500">
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
                      <code className="px-2 py-1 bg-background rounded border border-white/10 text-xs font-mono text-indigo-400">
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
                      <code className="px-2 py-1 bg-background rounded border border-white/10 text-xs font-mono text-emerald-400">
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
                      <code className="px-2 py-1 bg-background rounded border border-white/10 text-xs font-mono text-emerald-500">
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
          <div className="panel p-6 bg-card/60 backdrop-blur-sm border-white/5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              AI ইঞ্জিন
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">মডেল সিলেক্ট করুন</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full bg-background/50 border-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground/70">Custom API Key (Optional)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyOverride}
                  onChange={(e) => setApiKeyOverride(e.target.value)}
                  className="bg-background/50 border-white/5"
                />
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

          <div className="panel p-6 border-l-4 border-l-primary bg-primary/5 backdrop-blur-sm">
            <h2 className="font-bold mb-4">কুইক লিংক</h2>
            <div className="space-y-3">
              <Link to="/admin/webhook-test">
                <Button variant="outline" size="sm" className="w-full justify-start border-white/10 hover:bg-white/5">
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
