import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listTemplates, saveTemplate, deleteTemplate } from "@/lib/auto-replies.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Plus, Trash2, Edit2, Globe, Layout, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/auto-replies")({
  component: AutoRepliesPage,
});

function AutoRepliesPage() {
  const queryClient = useQueryClient();
  const fetchTemplates = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const remove = useServerFn(deleteTemplate);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["auto-reply-templates"],
    queryFn: () => fetchTemplates(),
  });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => save({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-templates"] });
      toast.success("টেমপ্লেট সেভ হয়েছে");
      setEditing(null);
      setIsNew(false);
    },
    onError: () => toast.error("সেভ করা যায়নি"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-templates"] });
      toast.success("টেমপ্লেট মুছে ফেলা হয়েছে");
    },
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 italic">
            <Sparkles className="size-8 text-primary" /> Auto-Reply Templates
          </h1>
          <p className="mt-2 text-muted-foreground">
            সরাসরি সোশ্যাল প্ল্যাটফর্মে উত্তরের জন্য প্রি-ডিজাইন করা টেমপ্লেট ম্যানেজ করুন।
          </p>
        </div>
        {!isNew && !editing && (
          <Button onClick={() => setIsNew(true)} className="rounded-full shadow-lg shadow-primary/20">
            <Plus className="size-4 mr-2" /> নতুন টেমপ্লেট
          </Button>
        )}
      </div>

      {(isNew || editing) && (
        <div className="panel p-6 mb-8 border-t-4 border-t-primary animate-in slide-in-from-top-4">
          <h2 className="text-xl font-bold mb-6 italic">{editing ? "এডিট করুন" : "নতুন টেমপ্লেট যোগ করুন"}</h2>
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
                variables: [],
              });
            }}
            className="grid gap-6 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>টেমপ্লেট নাম</Label>
              <Input name="name" defaultValue={editing?.name} placeholder="যেমন: স্বাগতম মেসেজ" required />
            </div>
            <div className="space-y-2">
              <Label>প্ল্যাটফর্ম</Label>
              <Select name="platform" defaultValue={editing?.platform || "messenger"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="messenger">Messenger</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="web">Website Chat</SelectItem>
                  <SelectItem value="all">All Platforms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ভাষা</Label>
              <Select name="language" defaultValue={editing?.language || "bn"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bn">Bengali (বাংলা)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="banglish">Banglish (বাংলা ইন ল্যাটিন)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>মেসেজ টেক্সট</Label>
              <Textarea 
                name="template_text" 
                defaultValue={editing?.template_text} 
                rows={4} 
                placeholder="যেমন: আমাদের পেজে স্বাগতম! আপনি কি অর্ডার করতে চান?" 
                required 
              />
              <p className="text-[10px] text-muted-foreground italic">টিপস: ভেরিয়েবল হিসেবে {`{product_name}, {price}`} ব্যবহার করতে পারেন।</p>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
                সেভ করুন
              </Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}>
                বাতিল
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates?.map((t: any) => (
          <div key={t.id} className="panel panel-hover p-5 border-l-4 border-l-primary/30 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="size-5 text-primary" />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(t)}>
                  <Edit2 className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => {
                  if(confirm("মুছে ফেলতে চান?")) deleteMutation.mutate(t.id);
                }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <h3 className="font-bold text-lg mb-1">{t.name}</h3>
            <div className="flex gap-2 mb-4">
              <span className="flex items-center gap-1 text-[10px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <Layout className="size-2.5" /> {t.platform}
              </span>
              <span className="flex items-center gap-1 text-[10px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <Globe className="size-2.5" /> {t.language}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4 italic">
              "{t.template_text}"
            </p>
            <div className="mt-auto pt-3 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between">
              <span>আপডেট: {new Date(t.updated_at).toLocaleDateString("bn-BD")}</span>
              <span className="text-primary font-bold">Active</span>
            </div>
          </div>
        ))}
        {templates?.length === 0 && !isNew && (
          <div className="col-span-full py-20 text-center panel bg-muted/20 border-dashed">
            <MessageSquare className="size-12 mx-auto text-muted-foreground opacity-20 mb-4" />
            <p className="text-muted-foreground">কোনো টেমপ্লেট নেই। নতুন টেমপ্লেট যোগ করুন।</p>
          </div>
        )}
      </div>
    </div>
  );
}
