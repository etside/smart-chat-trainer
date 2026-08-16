-- Usage thresholds and notifications table
CREATE TABLE IF NOT EXISTS public.usage_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threshold_credits INTEGER NOT NULL,
    threshold_usd DECIMAL(10, 4) NOT NULL,
    threshold_bdt DECIMAL(10, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'monthly')),
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification log
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    metadata JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_alerts TO authenticated;
GRANT ALL ON public.usage_alerts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

-- Enable RLS
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage usage_alerts" 
ON public.usage_alerts FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage notification_logs" 
ON public.notification_logs FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Function to check thresholds and notify
CREATE OR REPLACE FUNCTION public.check_usage_thresholds()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    daily_stats JSONB;
    monthly_stats JSONB;
    alert_row RECORD;
BEGIN
    -- Get daily stats
    SELECT jsonb_build_object(
        'credits', COALESCE(SUM(credits_used), 0),
        'usd', COALESCE(SUM(cost_usd), 0),
        'bdt', COALESCE(SUM(cost_bdt), 0)
    ) INTO daily_stats
    FROM usage_logs
    WHERE created_at >= CURRENT_DATE;

    -- Get monthly stats
    SELECT jsonb_build_object(
        'credits', COALESCE(SUM(credits_used), 0),
        'usd', COALESCE(SUM(cost_usd), 0),
        'bdt', COALESCE(SUM(cost_bdt), 0)
    ) INTO monthly_stats
    FROM usage_logs
    WHERE created_at >= date_trunc('month', CURRENT_DATE);

    -- Check daily alerts
    FOR alert_row IN SELECT * FROM usage_alerts WHERE type = 'daily' AND is_active = true LOOP
        IF (daily_stats->>'credits')::int >= alert_row.threshold_credits OR 
           (daily_stats->>'usd')::decimal >= alert_row.threshold_usd OR
           (daily_stats->>'bdt')::decimal >= alert_row.threshold_bdt THEN
            
            -- Only trigger if not triggered today
            IF alert_row.last_triggered_at IS NULL OR alert_row.last_triggered_at < CURRENT_DATE THEN
                INSERT INTO notification_logs (title, message, type, metadata)
                VALUES (
                    'ডেইলি ইউসেজ লিমিট অতিক্রম করেছে',
                    format('আপনার ডেইলি লিমিট (%s ক্রেডিট / ৳%s) অতিক্রম করেছে। বর্তমান ব্যবহার: %s ক্রেডিট / ৳%s', 
                        alert_row.threshold_credits, alert_row.threshold_bdt, 
                        daily_stats->>'credits', daily_stats->>'bdt'),
                    'usage_alert',
                    daily_stats
                );
                
                UPDATE usage_alerts SET last_triggered_at = NOW() WHERE id = alert_row.id;
            END IF;
        END IF;
    END LOOP;

    -- Check monthly alerts
    FOR alert_row IN SELECT * FROM usage_alerts WHERE type = 'monthly' AND is_active = true LOOP
        IF (monthly_stats->>'credits')::int >= alert_row.threshold_credits OR 
           (monthly_stats->>'usd')::decimal >= alert_row.threshold_usd OR
           (monthly_stats->>'bdt')::decimal >= alert_row.threshold_bdt THEN
            
            -- Only trigger if not triggered this month
            IF alert_row.last_triggered_at IS NULL OR alert_row.last_triggered_at < date_trunc('month', CURRENT_DATE) THEN
                INSERT INTO notification_logs (title, message, type, metadata)
                VALUES (
                    'মান্থলি ইউসেজ লিমিট অতিক্রম করেছে',
                    format('আপনার মান্থলি লিমিট (%s ক্রেডিট / ৳%s) অতিক্রম করেছে। বর্তমান ব্যবহার: %s ক্রেডিট / ৳%s', 
                        alert_row.threshold_credits, alert_row.threshold_bdt, 
                        monthly_stats->>'credits', monthly_stats->>'bdt'),
                    'usage_alert',
                    monthly_stats
                );
                
                UPDATE usage_alerts SET last_triggered_at = NOW() WHERE id = alert_row.id;
            END IF;
        END IF;
    END LOOP;
END;
$$
