import { getStats, exportTrainingData } from "@/lib/console.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Database, MessageSquare, Users, Download, Activity, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const fetchStats = useServerFn(getStats);
  const exportData = useServerFn(exportTrainingData);
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats() });

  const handleExport = async (type: "training_pairs" | "conversations") => {
    try {
      const res = await exportData({ data: { type } });
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("এক্সপোর্ট সফল হয়েছে");
    } catch {
      toast.error("এক্সপোর্ট করা যায়নি");
    }
  };

  const cards = [
    { label: "কথোপকথন", value: data?.conversations, icon: Users },
    { label: "মেসেজ", value: data?.messages, icon: MessageSquare },
    { label: "অ্যাপ্রুভড ট্রেনিং জোড়া", value: data?.approved, icon: CheckCircle2 },
    { label: "পেন্ডিং রিভিউ", value: data?.pending, icon: Clock },
    { label: "AI ক্রেডিট ব্যবহার", value: data?.creditUsage?.toFixed(2), icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">ড্যাশবোর্ড</h1>
      <div className="mt-3 p-4 bg-muted/50 rounded-xl text-[10px] leading-relaxed text-muted-foreground border border-border/50 font-mono whitespace-pre-wrap animate-in overflow-hidden">
        {`'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''

Authentication verified and operational. (Action: catalog, session ID required)`}
      </div>

Set up the Wear Impressive AI Webhook integration.

## Endpoint
POST https://api.v2.wearimpressive.com/api/ai/webhook

## Authentication — TWO layers required on every request

1. Bearer token in Authorization header:
   Authorization: Bearer f5e1f9b68be9fc8d69867283a6ebdf61755f23e93ff0c014def36f555d7fb42f

2. HMAC-SHA256 body signature in X-AI-Signature header:
   - Compute: HMAC-SHA256(rawRequestBody, secret)
   - Secret: c05d89defdc77a396b6543c85bce957bb5a12394a0828c54825817d51b3cd58a
   - Format header as: X-AI-Signature: sha256=<hex_digest>

   Example (TypeScript):
   import { createHmac } from 'crypto';
   const body = JSON.stringify(payload);
   const sig = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

## Request format
Every request body is JSON with a mandatory "action" field:
{ "action": "...", "session": "unique-session-id", ...other fields }

## Available actions

### Browse catalogue
{ "action": "catalog", "search": "shirt", "in_stock": true, "per_page": 20, "page": 1 }

### Single product detail
{ "action": "product", "id": 123 }
// or by slug:
{ "action": "product", "slug": \"blue-shirt\" }

### Check stock
{ "action": "stock", "product_ids": [1, 2, 3] }

### List categories
{ "action": "categories" }

### Add to cart
{ "action": "cart_add", "session": "sess-abc", "product_id": 123, "variant_id": 456, "quantity": 1 }

### View cart
{ "action": "cart_view", "session": "sess-abc" }

### Clear cart
{ "action": "cart_clear", "session": "sess-abc" }

### Place order (COD, auto-confirmed — no admin approval needed)
{
  "action": "order_place",
  "session": "sess-abc",
  "payment_method": "cod",
  "shipping_address": {
    "full_name": "Rahim Uddin",
    "phone": "01711000000",
    "address_line_1": "123 Main St",
    "division": "Dhaka",
    "district": "Dhaka",
    "thana": "Mirpur"
  },
  "notes": "Optional delivery note"
}

### Track order
{ "action": "order_status", "order_number": "WI-260816-XXXXX" }

## Response format
Success: { "success": true, "action": "catalog", "data": { ... } }
Error:   { "success": false, "error": "message" }

## Notes
- Orders are placed as COD and auto-confirmed (status = \"confirmed\")
- Delivery is NOT assigned automatically — store handles fulfillment manually
- Cart is session-scoped and expires after 30 minutes of inactivity
- Currency is BDT
- Store is automatically resolved — no store_id needed`}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c, i) => (
          <div 
            key={c.label} 
            className="panel panel-hover p-6 border-t-2 border-t-primary/20 bg-card/50 backdrop-blur-sm animate-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <c.icon className="size-5 text-primary/70" />
              <div className="size-2 rounded-full bg-success/20 animate-pulse" />
            </div>
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {isLoading ? "—" : c.value}
            </p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/admin/add" className="panel panel-hover block p-6">
          <Database className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">নতুন ডেটা যোগ করুন</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ভয়েস, টেক্সট বা JSON আপলোড — যোগ করলেই AI সঙ্গে সঙ্গে শিখে নেয়।
          </p>
        </Link>
        <Link
          to="/admin/playground"
          className="panel panel-hover block p-6"
        >
          <MessageSquare className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">এজেন্ট পরীক্ষা করুন</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            কাস্টমারের মতো প্রশ্ন করে উত্তরের মান যাচাই করুন।
          </p>
        </Link>
        <Link
          to="/admin/sync"
          className="panel panel-hover block p-6 border-primary/20 bg-primary/5 shadow-primary/5"
        >
          <Activity className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">প্রোডাক্ট সিঙ্ক</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ইনভেন্টরি এবং প্রোডাক্ট ডেটা অটোমেটিক সিঙ্ক ম্যানেজ করুন।
          </p>
        </Link>
        <Link
          to="/admin/webhook-test"
          className="panel panel-hover block p-6"
        >
          <Terminal className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">ওয়েবহুক টেস্ট প্যানেল</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ভয়েস বা টেক্সট পাঠিয়ে AI রেসপন্স এবং লগ যাচাই করুন।
          </p>
        </Link>
        <Link
          to="/admin/progress"
          className="panel panel-hover block p-6"
        >
          <Activity className="size-5 text-primary" />
          <h2 className="mt-3 font-semibold">ট্রেনিং প্রগ্রেস</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            অটোমেটিক ট্রেনিং জব এবং স্ট্যাটাস দেখুন।
          </p>
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">ডেটা এক্সপোর্ট</h2>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => handleExport("training_pairs")}>
            <Download className="mr-2 h-4 w-4" /> ট্রেনিং জোড়া এক্সপোর্ট
          </Button>
          <Button variant="outline" onClick={() => handleExport("conversations")}>
            <Download className="mr-2 h-4 w-4" /> কথোপকথন এক্সপোর্ট
          </Button>
        </div>
      </div>
    </div>
  );
}
