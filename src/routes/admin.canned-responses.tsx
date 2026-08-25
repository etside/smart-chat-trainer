import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  listCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from "@/lib/canned-responses.functions";
import { getMyRole } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  Tag,
  Command,
  FileText,
  Layers,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/canned-responses")({
  component: CannedResponsesPage,
});

type CannedResponse = {
  id: string;
  name: string;
  shortcut: string | null;
  category: string | null;
  content: string;
  variables: unknown;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
};

type FormState = {
  name: string;
  shortcut: string;
  category: string;
  content: string;
};

const DEFAULT_CATEGORIES = [
  { value: "general", label: "সাধারণ" },
  { value: "greeting", label: "শুভেচ্ছা" },
  { value: "pricing", label: "মূল্য" },
  { value: "shipping", label: "ডেলিভারি" },
  { value: "return", label: "রিটার্ন" },
  { value: "faq", label: "সচরাচর জিজ্ঞাসা" },
  { value: "thanks", label: "ধন্যবাদ" },
  { value: "follow-up", label: "ফলো-আপ" },
  { value: "escalation", label: "এস্কেলেশন" },
];

const EMPTY_FORM: FormState = {
  name: "",
  shortcut: "",
  category: "general",
  content: "",
};

function highlightVariables(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={`var-${keyIdx++}`}
        className="inline-block bg-primary/15 text-primary font-bold text-[10px] px-1.5 py-0.5 rounded mx-0.5"
      >
        {`{{${match[1]}}}`}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function CannedResponsesPage() {
  const queryClient = useQueryClient();
  const fetchResponses = useServerFn(listCannedResponses);
  const createFn = useServerFn(createCannedResponse);
  const updateFn = useServerFn(updateCannedResponse);
  const deleteFn = useServerFn(deleteCannedResponse);
  const fetchMyRole = useServerFn(getMyRole);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const roleQuery = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
  });

  const { data: responses, isLoading } = useQuery({
    queryKey: ["canned-responses"],
    queryFn: () => fetchResponses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      createFn({
        data: {
          name: data.name,
          shortcut: data.shortcut || undefined,
          category: data.category,
          content: data.content,
          variables: extractVariables(data.content),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-responses"] });
      toast.success("টেমপ্লেট তৈরি হয়েছে");
      closeDialog();
    },
    onError: () => toast.error("তৈরি করা যায়নি"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormState & { id: string }) =>
      updateFn({
        data: {
          id: data.id,
          name: data.name,
          shortcut: data.shortcut || undefined,
          category: data.category,
          content: data.content,
          variables: extractVariables(data.content),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-responses"] });
      toast.success("আপডেট হয়েছে");
      closeDialog();
    },
    onError: () => toast.error("আপডেট করা যায়নি"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-responses"] });
      toast.success("মুছে ফেলা হয়েছে");
    },
    onError: () => toast.error("মুছে ফেলা যায়নি"),
  });

  const userRole = roleQuery.data?.role || "viewer";
  const canEdit = userRole === "admin" || userRole === "editor";

  function extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((v: string) => v.replace(/[{}]/g, "")))];
  }

  function openNewDialog() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(item: CannedResponse) {
    setEditing(item);
    setForm({
      name: item.name,
      shortcut: item.shortcut || "",
      category: item.category || "general",
      content: item.content,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ ...form, id: editing.id });
    } else {
      createMutation.mutate(form);
    }
  }

  const filtered = useMemo(() => {
    if (!responses) return [];
    const q = search.toLowerCase();
    if (!q) return responses;
    return responses.filter(
      (r: CannedResponse) =>
        r.name.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.shortcut && r.shortcut.toLowerCase().includes(q)),
    );
  }, [responses, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CannedResponse[]>();
    for (const r of filtered) {
      const cat = r.category || "general";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return map;
  }, [filtered]);

  const categories = useMemo(() => {
    if (!responses) return DEFAULT_CATEGORIES;
    const fromData = [...new Set(responses.map((r: CannedResponse) => r.category || "general"))];
    const all = [...new Set([...DEFAULT_CATEGORIES.map((c) => c.value), ...fromData])];
    return all.map((v) => {
      const found = DEFAULT_CATEGORIES.find((c) => c.value === v);
      return { value: v, label: found?.label || v };
    });
  }, [responses]);

  const getCategoryLabel = (value: string | null) => {
    if (!value) return "general";
    const found = categories.find((c) => c.value === value);
    return found?.label || value;
  };

  if (isLoading) {
    return (
      <div className="p-10 text-center text-muted-foreground">লোড হচ্ছে...</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 italic">
            <FileText className="size-8 text-primary" /> ক্যানড রেসপন্স
          </h1>
          <p className="mt-2 text-muted-foreground">
            পুনরাবৃত্ত উত্তরের টেমপ্লেট তৈরি ও পরিচালনা করুন
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={openNewDialog}
            className="rounded-full shadow-lg shadow-primary/20"
          >
            <Plus className="size-4 mr-2" /> নতুন টেমপ্লেট
          </Button>
        )}
      </div>

      {/* Search / Filter */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম বা ক্যাটাগরি দিয়ে খুঁজুন..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Grouped Cards */}
      {grouped.size === 0 ? (
        <div className="py-20 text-center panel bg-muted/20 border-dashed">
          <MessageSquare className="size-12 mx-auto text-muted-foreground opacity-20 mb-4" />
          <p className="text-muted-foreground">
            {search
              ? "কোনো টেমপ্লেট পাওয়া যায়নি"
              : "কোনো টেমপ্লেট নেই। নতুন টেমপ্লেট যোগ করুন।"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="size-4 text-primary" />
                <h2 className="text-lg font-bold italic">
                  {getCategoryLabel(category)}
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item: CannedResponse) => (
                  <Card
                    key={item.id}
                    className="panel panel-hover border-l-4 border-l-primary/30 flex flex-col"
                  >
                    <CardContent className="p-5 flex flex-col flex-1">
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="size-5 text-primary" />
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              onClick={() => {
                                if (confirm("মুছে ফেলতে চান?"))
                                  deleteMutation.mutate(item.id);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Name + Shortcut */}
                      <div className="mb-2">
                        <h3 className="font-bold text-lg leading-tight">
                          {item.name}
                        </h3>
                        {item.shortcut && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <Command className="size-2.5" /> /{item.shortcut}
                          </span>
                        )}
                      </div>

                      {/* Category Badge */}
                      <div className="mb-3">
                        <span className="flex items-center gap-1 text-[10px] uppercase font-black bg-muted px-2 py-0.5 rounded-full text-muted-foreground w-fit">
                          <Tag className="size-2.5" />{" "}
                          {getCategoryLabel(item.category)}
                        </span>
                      </div>

                      {/* Content Preview with highlighted variables */}
                      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 mb-4 line-clamp-4 leading-relaxed">
                        {highlightVariables(item.content)}
                      </div>

                      {/* Variables */}
                      {Array.isArray(item.variables) && item.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.variables.map((v: string) => (
                            <span
                              key={v}
                              className="inline-block bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded"
                            >
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="mt-auto pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
                        তৈরি:{" "}
                        {item.created_at ? new Date(item.created_at).toLocaleDateString("bn-BD") : "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="italic">
              {editing ? "টেমপ্লেট এডিট করুন" : "নতুন টেমপ্লেট যোগ করুন"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "টেমপ্লেটের তথ্য আপডেট করুন"
                : "নতুন ক্যানড রেসপন্স টেমপ্লেট তৈরি করুন"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>
                টেমপ্লেট নাম <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="যেমন: স্বাগতম মেসেজ"
                required
                maxLength={100}
              />
            </div>

            {/* Shortcut + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>শর্টকাট</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                    /
                  </span>
                  <Input
                    value={form.shortcut}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        shortcut: e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""),
                      }))
                    }
                    placeholder="যেমন: welcome"
                    className="pl-7"
                    maxLength={20}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  শুধু ইংরেজি অক্ষর, সংখ্যা এবং (- _)
                </p>
              </div>

              <div className="space-y-2">
                <Label>ক্যাটাগরি</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm((p) => ({ ...p, category: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>
                উত্তরের কন্টেন্ট <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((p) => ({ ...p, content: e.target.value }))
                }
                placeholder="যেমন: স্বাগতম {{name}}! আমাদের দাম {{price}} টাকা।"
                rows={5}
                required
                maxLength={4000}
              />
              <p className="text-[10px] text-muted-foreground italic">
                টিপস:{" "}
                <code className="bg-muted px-1 rounded">
                  {"{{variable_name}}"}
                </code>{" "}
                ব্যবহার করে ডায়নামিক মান পাঠাতে পারেন।
              </p>
              {/* Preview */}
              {form.content && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <span className="text-[10px] uppercase font-black text-muted-foreground block mb-1">
                    প্রিভিউ:
                  </span>
                  {highlightVariables(form.content)}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
              >
                বাতিল
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !form.name.trim() ||
                  !form.content.trim()
                }
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <MessageSquare className="size-4 mr-2" />
                )}
                {editing ? "আপডেট করুন" : "তৈরি করুন"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
