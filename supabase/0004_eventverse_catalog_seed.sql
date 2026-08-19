insert into public.categories (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001','Concerts','concerts'),
  ('10000000-0000-0000-0000-000000000002','Parties','parties'),
  ('10000000-0000-0000-0000-000000000003','Festivals','festivals'),
  ('10000000-0000-0000-0000-000000000004','Comedy','comedy'),
  ('10000000-0000-0000-0000-000000000005','Sports','sports')
on conflict (id) do nothing;

insert into public.venues (id, name, city, address, capacity) values
  ('20000000-0000-0000-0000-000000000001','ABC Event Centre','Ado-Ekiti','Adebayo Road',2500),
  ('20000000-0000-0000-0000-000000000002','Eko Convention Centre','Lagos','Victoria Island',6000),
  ('20000000-0000-0000-0000-000000000003','Freedom Park','Lagos','Hospital Road',3500),
  ('20000000-0000-0000-0000-000000000004','Terra Kulture','Lagos','Tiamiyu Savage Street',1200),
  ('20000000-0000-0000-0000-000000000005','Julius Berger Hall','Abuja','Central Business District',3000),
  ('20000000-0000-0000-0000-000000000006','Nike Lake Resort','Enugu','Nike Lake Road',2200)
on conflict (id) do nothing;

insert into public.artists (id, name, bio, verified, follower_count, image_url) values
  ('30000000-0000-0000-0000-000000000001','Wizkid','Nigerian singer and global afrobeats performer.',true,5300000,'linear-gradient(160deg,#3A2A1B,#16261D)'),
  ('30000000-0000-0000-0000-000000000002','Asake','Afrobeats artist known for energetic live performances.',true,3100000,'linear-gradient(160deg,#1E3327,#12141C)'),
  ('30000000-0000-0000-0000-000000000003','Tems','Singer, songwriter, and producer.',true,4000000,'linear-gradient(160deg,#4A3624,#0B0A08)'),
  ('30000000-0000-0000-0000-000000000004','Rema','Afrobeats and alt-pop performer.',true,6100000,'linear-gradient(160deg,#16261D,#3A2A1B)'),
  ('30000000-0000-0000-0000-000000000005','Burna Boy','Grammy-winning Nigerian artist.',true,7200000,'linear-gradient(160deg,#4A3624,#1E3327)'),
  ('30000000-0000-0000-0000-000000000006','Ayra Starr','Nigerian singer and songwriter.',true,2900000,'linear-gradient(160deg,#1E3327,#3A2A1B)')
on conflict (id) do nothing;

insert into public.events (id, title, description, event_type, city, venue_id, starts_at, cover_url, status, rating, review_count) values
  ('40000000-0000-0000-0000-000000000001','Wizkid Live In Concert','A live celebration of Afrobeats and global sounds.','Concert','Ado-Ekiti','20000000-0000-0000-0000-000000000001','2026-09-14T19:00:00+01:00','linear-gradient(160deg,#3A2A1B,#16261D)','PUBLISHED',4.80,130),
  ('40000000-0000-0000-0000-000000000002','Burna Boy — The Summit','A headline arena performance with special guests.','Concert','Lagos','20000000-0000-0000-0000-000000000002','2026-09-02T20:00:00+01:00','linear-gradient(160deg,#4A3624,#1E3327)','PUBLISHED',4.90,340),
  ('40000000-0000-0000-0000-000000000003','The Vibes Fest','A full afternoon of music, food, and community.','Festival','Lagos','20000000-0000-0000-0000-000000000003','2026-09-10T15:00:00+01:00','linear-gradient(160deg,#16261D,#0B0A08)','PUBLISHED',4.60,88),
  ('40000000-0000-0000-0000-000000000004','Odi Aviction Live','An intimate live set in the heart of Lagos.','Concert','Lagos','20000000-0000-0000-0000-000000000004','2026-09-18T18:00:00+01:00','linear-gradient(160deg,#3A2A1B,#12141C)','PUBLISHED',4.50,52),
  ('40000000-0000-0000-0000-000000000005','Ayra Starr — Solar','An evening of pop, afrobeats, and unforgettable energy.','Concert','Abuja','20000000-0000-0000-0000-000000000005','2026-09-22T19:30:00+01:00','linear-gradient(160deg,#1E3327,#3A2A1B)','PUBLISHED',4.70,210),
  ('40000000-0000-0000-0000-000000000006','Phyno — Live In Enugu','A homecoming performance by one of Nigeria’s finest.','Concert','Enugu','20000000-0000-0000-0000-000000000006','2026-09-26T17:00:00+01:00','linear-gradient(160deg,#12141C,#16261D)','PUBLISHED',4.40,63)
on conflict (id) do nothing;

insert into public.event_artists (event_id, artist_id) values
  ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005'),
  ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000003'),
  ('40000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000006'),
  ('40000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.event_categories (event_id, category_id) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.ticket_types (id, event_id, name, price, capacity, sales_start, maximum_per_customer) values
  ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Regular',5000,1800,'2026-05-01T00:00:00+01:00',6),
  ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','VIP',15000,400,'2026-05-01T00:00:00+01:00',4),
  ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','Regular',7500,4200,'2026-05-01T00:00:00+01:00',6),
  ('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','General Admission',4000,2500,'2026-05-01T00:00:00+01:00',6),
  ('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000004','Standard',6000,900,'2026-05-01T00:00:00+01:00',4),
  ('50000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000005','Regular',8000,2200,'2026-05-01T00:00:00+01:00',6),
  ('50000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000006','Regular',5500,1700,'2026-05-01T00:00:00+01:00',6)
on conflict (id) do nothing;

insert into public.songs (id, artist_id, title, duration_seconds, cover_url, play_count) values
  ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Mood',225,'linear-gradient(160deg,#3A2A1B,#16261D)',12500000),
  ('60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005','Last Last',192,'linear-gradient(160deg,#4A3624,#1E3327)',20100000),
  ('60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000006','Rush',178,'linear-gradient(160deg,#1E3327,#3A2A1B)',9300000),
  ('60000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','Calm Down',210,'linear-gradient(160deg,#16261D,#3A2A1B)',31400000),
  ('60000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000002','Love Nwantiti',185,'linear-gradient(160deg,#4A3624,#0B0A08)',44200000)
on conflict (id) do nothing;
