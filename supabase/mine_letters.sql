-- (선택) 채굴 제보 답장을 체크인이 가져가지 않게 — 형이 적용 여부 결정 (2026-10-24 서버 적용 완료)
-- 지금: 채굴은 보낸 편지 id 를 세이브에 두고 내 편지 select 정책으로 답장을 직접 읽는다(읽음 표시 안 함).
--       체크인의 my_letter_replies() 는 채굴 편지 답장도 체크인 우편함에 넣고 읽음으로 바꾼다(채굴에선 그래도 보임).
-- 이걸 적용하면: 체크인(인자 없이 부름)은 채굴 편지를 빼고, 채굴은 my_letter_replies('mine') 으로 자기 것만.
drop function if exists public.my_letter_replies();
create or replace function public.my_letter_replies(p_app text default null)
 returns table(id bigint, body text, reply text, status text, ver_fixed text, replied_at timestamptz)
 language sql stable security definer set search_path to 'public'
as $$
  select l.id, l.body, l.reply, l.status, l.ver_fixed, l.replied_at
  from public.bug_letters l
  where l.user_id = auth.uid() and l.reply is not null and not l.reply_read
    and (case when p_app = 'mine' then coalesce(l.app_version, '') like 'mine-%' else coalesce(l.app_version, '') not like 'mine-%' end)
  order by l.replied_at nulls last, l.id
  limit 20;
$$;
revoke all on function public.my_letter_replies(text) from public, anon;
grant execute on function public.my_letter_replies(text) to authenticated;
