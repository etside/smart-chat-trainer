# Wear Impressive — AI Sales Agent Training Console

একটা admin website যেখানে আপনার Facebook/Messenger conversation data দিয়ে একটা AI sales agent তৈরি হবে, আপনি নতুন data (text + voice) দিয়ে ওকে আরও train করতে পারবেন, আর অন্য platform (Messenger, WhatsApp, website chat) থেকে API দিয়ে connect করে reply নিতে পারবেন।

## আপলোড করা data

- ৯,৮৯১ টা conversation, ১,২১,৭৪১ টা message (৩টা JSON file)
- Pattern: `{ conversation_id, messages: [{ role: "user" | "assistant", content }] }`

## যা তৈরি হবে

### 1. Login (admin only)
- Email + password login। শুধু `aniktonmoybd@gmail.com` account-টা admin — অন্য কেউ signup করলেও console-এ ঢুকতে পারবে না।
- Password আপনি যেটা দিয়েছেন সেটাই সেট করা হবে; পরে বদলানো যাবে।

### 2. Knowledge / Training data
- আপলোড করা ৩টা JSON import হয়ে database-এ যাবে (conversation + message আলাদা টেবিলে)।
- প্রতিটা assistant reply-র জন্য একটা "training pair" (user question → assistant answer) তৈরি হবে, যেটাই agent-এর উত্তরের ভিত্তি।
- Console-এ: search, browse, edit, delete, approve/reject করা যাবে — খারাপ বা ভুল reply বাদ দেওয়া যাবে।

### 3. নতুন data যোগ করার ৩টা উপায়
- **Text**: question + answer জোড়া লিখে save।
- **Voice**: ব্রাউজারে mic দিয়ে record → Lovable AI দিয়ে transcribe (বাংলা/বাংলিশ সাপোর্ট) → transcript থেকে AI নিজেই JSON pattern (`user`/`assistant` জোড়া) বানিয়ে দেবে → আপনি দেখে edit করে approve করবেন।
- **JSON/file upload**: ভবিষ্যতে একই format-এর নতুন export ফাইল আপলোড করলে সরাসরি import হবে।
- **Auto-train**: live chat বা connected platform-এর প্রতিটা কথোপকথন নিজে থেকেই "pending" হিসেবে জমা হবে; আপনি approve দিলে সেটা training data-য় যুক্ত হয়ে যাবে (auto-approve mode-ও থাকবে)।

### 4. Agent Playground
- Console-এর ভিতরেই chat করে test করা যাবে — আগে যেমন reply দিতেন ঠিক সেই tone/দাম/delivery charge/size question-এর style-এ উত্তর আসবে।
- System prompt (দোকানের নিয়ম, delivery charge, payment) edit করার settings page।

### 5. অন্য platform-এ connect
- একটা public API endpoint (`/api/public/chat`) — API key দিয়ে secure।
- যেকোনো platform (Messenger bot, WhatsApp, website widget, n8n/Zapier) সেখানে message পাঠালে agent-এর reply ফেরত পাবে, আর কথোপকথন auto-train queue-তে জমা হবে।
- Console-এ API key তৈরি/বাতিল করার page + copy-paste করার মতো instruction।

## কীভাবে উত্তর দেবে (technical)

- প্রতিটা training pair-এর embedding তৈরি হবে; নতুন প্রশ্ন এলে সবচেয়ে কাছের পুরোনো উদাহরণগুলো খুঁজে (semantic search) সেগুলো সহ Lovable AI-কে দেওয়া হবে — তাই উত্তর আপনার আসল reply-র মতোই হবে এবং নতুন data দিলেই সঙ্গে সঙ্গে "শিখে" যাবে (আলাদা করে model retrain লাগবে না)।
- Backend: Lovable Cloud (database + auth + storage), pgvector দিয়ে search।
- AI: Lovable AI Gateway — chat, transcription, embeddings সব এখানেই।
- ১.২ লাখ message ধাপে ধাপে (background batch) import + embed হবে, যাতে সাইট slow না হয়।

## Design

পরিষ্কার, হালকা admin dashboard — Wear Impressive-এর জন্য soft neutral + একটা accent color, বাংলা text ভালোভাবে পড়া যায় এমন font। Sidebar: Dashboard, Training Data, Add Data (Text/Voice), Playground, Connections, Settings।

## ধাপে ধাপে build

1. Lovable Cloud enable + database schema + admin login
2. JSON import pipeline (৩টা ফাইল) + Training Data browser
3. Embeddings + retrieval + Playground chat
4. Voice recording + transcription + auto JSON pattern
5. Public API + API keys + auto-train queue
