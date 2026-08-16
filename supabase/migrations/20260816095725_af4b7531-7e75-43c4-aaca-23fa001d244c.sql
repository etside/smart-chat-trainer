CREATE OR REPLACE FUNCTION public.get_usage_aggregates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_credits', COALESCE(SUM(credits_used), 0),
        'total_usd', COALESCE(SUM(cost_usd), 0),
        'total_bdt', COALESCE(SUM(cost_bdt), 0),
        'count', COUNT(*)
    ) INTO result
    FROM public.usage_logs;
    
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_agent_credits(amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.agent_settings
    SET credit_usage = COALESCE(credit_usage, 0) + amount
    WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_usage_aggregates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_agent_credits(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_aggregates() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_agent_credits(NUMERIC) TO service_role;
