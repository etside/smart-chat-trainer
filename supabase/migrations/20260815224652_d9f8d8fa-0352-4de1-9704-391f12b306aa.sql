
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- auto-admin for the owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'aniktonmoybd@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  source text NOT NULL DEFAULT 'import',
  channel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_source_idx ON public.conversations(source);
CREATE INDEX conversations_external_idx ON public.conversations(external_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage conversations" ON public.conversations FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, seq);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage messages" ON public.messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- training pairs
CREATE TABLE public.training_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  context text,
  source text NOT NULL DEFAULT 'import',
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','pending','rejected')),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX training_pairs_status_idx ON public.training_pairs(status);
CREATE INDEX training_pairs_created_idx ON public.training_pairs(created_at DESC);
CREATE INDEX training_pairs_q_trgm ON public.training_pairs USING gin (question gin_trgm_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_pairs TO authenticated;
GRANT ALL ON public.training_pairs TO service_role;
ALTER TABLE public.training_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage training pairs" ON public.training_pairs FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- settings
CREATE TABLE public.agent_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  system_prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'openai/gpt-5.6-sol',
  auto_approve boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage settings" ON public.agent_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.agent_settings (id, system_prompt) VALUES (1,
'তুমি Wear Impressive (wearimpressive.com) নামের বাংলাদেশি অনলাইন ফ্যাশন পেজের কাস্টমার সাপোর্ট এজেন্ট। তুমি ঠিক যেভাবে পেজের এডমিন আগে উত্তর দিত সেভাবেই ছোট, বন্ধুত্বপূর্ণ, বাংলা/বাংলিশ মিশিয়ে উত্তর দিবে। দাম, সাইজ, ফেব্রিক, ডেলিভারি চার্জ (ঢাকা সিটি ৭০ টাকা, সাভার-কেরানীগঞ্জ-গাজীপুর-ধামরাই ১২০ টাকা, ঢাকার বাইরে ১৫০ টাকা) সম্পর্কে দেওয়া উদাহরণ অনুযায়ী উত্তর দিবে। যা জানো না তা বানিয়ে বলবে না।');

-- api keys
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage api keys" ON public.api_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- retrieval function
CREATE OR REPLACE FUNCTION public.search_training_pairs(_query text, _limit integer DEFAULT 8)
RETURNS TABLE (id uuid, question text, answer text, score real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tp.id, tp.question, tp.answer, similarity(tp.question, _query) AS score
  FROM public.training_pairs tp
  WHERE tp.status = 'approved' AND tp.question % _query
  ORDER BY score DESC
  LIMIT LEAST(COALESCE(_limit, 8), 25)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER training_pairs_updated BEFORE UPDATE ON public.training_pairs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
