-- Supabase cleanup function for expired / disconnected seats
-- Run this periodically via your scheduler or an Edge Function.

create or replace function public.cleanup_expired_room_players()
returns text language plpgsql as $$
declare
  lobby_release text := (select coalesce(value, '30') from public.game_config where name = 'lobby_release_seconds');
  in_game_grace text := (select coalesce(value, '60') from public.game_config where name = 'in_game_reconnect_seconds');
  _cnt int := 0;
begin
  -- Release seats in lobby when last heartbeat older than lobby_release
  update public.room_players rp
  set status = 'released', released_at = now()
  from public.rooms r
  where rp.room_id = r.id
    and r.status = 'lobby'
    and rp.status in ('active','disconnected')
    and rp.last_active_at < now() - (lobby_release || ' seconds')::interval;
  GET DIAGNOSTICS _cnt = ROW_COUNT;

  -- For playing rooms: mark active seats as disconnected if missed heartbeat
  update public.room_players rp
  set status = 'disconnected'
  from public.rooms r
  where rp.room_id = r.id
    and r.status = 'playing'
    and rp.status = 'active'
    and rp.last_active_at < now() - (lobby_release || ' seconds')::interval;

  -- For playing rooms: release seats that have been disconnected beyond in_game_grace
  update public.room_players rp
  set status = 'released', released_at = now()
  from public.rooms r
  where rp.room_id = r.id
    and r.status = 'playing'
    and rp.status = 'disconnected'
    and rp.last_active_at < now() - (in_game_grace || ' seconds')::interval;

  return format('Cleanup complete (released %s rows)', _cnt);
end;
$$;

-- NOTE: To schedule this periodically you can:
-- 1) Use Supabase scheduled functions (via the Dashboard -> Edge Functions scheduler)
-- 2) If you have pg_cron enabled, add a job: SELECT cron.schedule('*/1 * * * *', 'select public.cleanup_expired_room_players();');
-- 3) Call the function from an Edge Function and schedule the Edge Function.
