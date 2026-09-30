-- ============================================================
-- MedBridge — Supabase Realtime publication
-- ============================================================

-- Add tables to the realtime publication so the client can
-- subscribe to INSERT events via supabase.channel().on(...)

ALTER PUBLICATION supabase_realtime ADD TABLE public.temporary_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.identification_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.merge_events;
