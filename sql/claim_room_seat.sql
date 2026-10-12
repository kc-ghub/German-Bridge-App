-- SQL: claim_room_seat
-- Atomically claim a seat in room_players. Returns (success boolean, message text).

CREATE OR REPLACE FUNCTION public.claim_room_seat(
  p_room_id text,
  p_seat_number int,
  p_user_id uuid,
  p_shadow_id uuid
)
RETURNS TABLE(success boolean, message text) AS $$
BEGIN
  -- If seat is occupied by active/idle/disconnected player, report occupied
  IF EXISTS (
    SELECT 1 FROM public.room_players rp
    WHERE rp.room_id = p_room_id
      AND rp.seat_number = p_seat_number
      AND rp.status IN ('active','idle','disconnected')
  ) THEN
    RETURN QUERY SELECT false, 'occupied';
    RETURN;
  END IF;

  -- Ensure there is a profile row for this user, because room_players.user_id references profiles(id)
  INSERT INTO public.profiles (id, nickname)
  VALUES (p_user_id, 'Guest')
  ON CONFLICT (id) DO NOTHING;

  -- Insert or reuse a released seat; handle both seat-number conflicts and existing user rows
  BEGIN
    INSERT INTO public.room_players (room_id, user_id, seat_number, status, joined_at, last_active_at, shadow_id)
    VALUES (p_room_id, p_user_id, p_seat_number, 'active', now(), now(), p_shadow_id)
    ON CONFLICT (room_id, seat_number) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          status = 'active',
          joined_at = COALESCE(public.room_players.joined_at, now()),
          last_active_at = now(),
          shadow_id = EXCLUDED.shadow_id
      WHERE public.room_players.status IS NULL
        OR public.room_players.status = 'released'
        OR public.room_players.user_id = EXCLUDED.user_id;
  EXCEPTION WHEN unique_violation THEN
    -- A different unique constraint (likely the primary key on (room_id,user_id)) blocked the insert.
    -- Update the existing row for this user to move/activate them onto the requested seat.
    UPDATE public.room_players
    SET seat_number = p_seat_number,
        status = 'active',
        joined_at = COALESCE(joined_at, now()),
        last_active_at = now(),
        shadow_id = p_shadow_id
    WHERE room_id = p_room_id AND user_id = p_user_id;

    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 'occupied';
      RETURN;
    END IF;
  END;

  RETURN QUERY SELECT true, 'claimed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon if desired (be careful with permissions)
-- GRANT EXECUTE ON FUNCTION public.claim_room_seat(text,int,uuid,uuid) TO anon;
