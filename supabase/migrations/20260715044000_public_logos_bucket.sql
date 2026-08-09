-- Company logos are shown in outbound emails; email clients cannot use
-- private signed URLs reliably, so allow public read of the logos bucket.
update storage.buckets
set public = true
where id = 'logos';

drop policy if exists "Public read logos" on storage.objects;
create policy "Public read logos"
on storage.objects
for select
to public
using (bucket_id = 'logos');
