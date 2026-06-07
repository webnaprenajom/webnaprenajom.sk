-- Public bucket for contract templates and other admin assets
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', true)
on conflict (id) do nothing;

-- Public read policy
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read contracts'
  ) then
    create policy "Public read contracts" on storage.objects
      for select using (bucket_id = 'contracts');
  end if;
end $$;