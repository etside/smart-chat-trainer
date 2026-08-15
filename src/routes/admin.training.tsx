import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deletePair, listPairs, savePair, setPairStatus } from "@/lib/console.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/training")({
  component: TrainingData,
});

type Status = "all" | "approved" | "pending" | "rejected";

function TrainingData() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: string; question: string; answer: string } | null>(
    null,
  );

  const fetchPairs = useServerFn(listPairs);
  const save = useServerFn(savePair);
  const setStatusFn = useServerFn(setPairStatus);
  const remove = useServerFn(deletePair);

  const { data, isLoading } = useQuery({
    queryKey: ["pairs", term, status, page],
    queryFn: () => fetchPairs({ data: { search: term, status, page } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pairs"] });

  const saveMutation = useMutation({
    mutationFn: (v: { id: string; question: string; answer: string }) => save({ data: v }),
    onSuccess: () => {
      setEditing(null);
      toast.success("আপডেট হয়েছে");
      invalidate();
    },
    onError: () => toast.error("সেভ করা যায়নি।"),
  });

  const statusMutation = useMutation({
    mutationFn: (v: { ids: string[]; status: "approved" | "pending" | "rejected" }) =>
      setStatusFn({ data: v }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("মুছে ফেলা হয়েছে");
      invalidate();
    },
  });

  const total = data?.total ?? 0;
  const size = data?.size ?? 25;
  const maxPage = Math.max(0, Math.ceil(total / size) - 1);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">ট্রেনিং ডেটা</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        এজেন্ট এই প্রশ্ন-উত্তরগুলো দেখে উত্তর সাজায়। ভুল থাকলে এডিট বা বাতিল করুন।
      </p>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setTerm(search);
        }}
      >
        <Input
          className="max-w-xs"
          placeholder="খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as Status);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব</SelectItem>
            <SelectItem value="approved">অ্যাপ্রুভড</SelectItem>
            <SelectItem value="pending">পেন্ডিং</SelectItem>
            <SelectItem value="rejected">বাতিল</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="secondary">
          সার্চ
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">{total.toLocaleString("en-US")} টি ফলাফল</p>

      <div className="mt-3 space-y-3">
        {isLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        {data?.rows.map((row) => (
          <div key={row.id} className="panel p-4">
            {editing?.id === row.id ? (
              <div className="space-y-2">
                <Input
                  value={editing.question}
                  onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                />
                <Textarea
                  rows={3}
                  value={editing.answer}
                  onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMutation.mutate(editing)}>
                    সেভ
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    বাতিল
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{row.question}</p>
                  <Badge variant={row.status === "approved" ? "default" : "secondary"}>
                    {row.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {row.answer}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditing({ id: row.id, question: row.question, answer: row.answer })
                    }
                  >
                    <Pencil className="size-3.5" /> এডিট
                  </Button>
                  {row.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => statusMutation.mutate({ ids: [row.id], status: "approved" })}
                    >
                      <Check className="size-3.5" /> অ্যাপ্রুভ
                    </Button>
                  )}
                  {row.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => statusMutation.mutate({ ids: [row.id], status: "rejected" })}
                    >
                      <X className="size-3.5" /> বাতিল
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(row.id)}
                  >
                    <Trash2 className="size-3.5" /> ডিলিট
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          আগের
        </Button>
        <span className="text-xs text-muted-foreground">
          পৃষ্ঠা {page + 1} / {maxPage + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= maxPage}
          onClick={() => setPage((p) => p + 1)}
        >
          পরের
        </Button>
      </div>
    </div>
  );
}
