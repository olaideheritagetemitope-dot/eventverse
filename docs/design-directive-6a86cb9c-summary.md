# Atizzy Design Directive Summary

Source: https://chatgpt.com/s/t_6a86cb9c5bf0819181bfe668a0485251

The directive requires a reusable EventVerse visual language rather than page-by-page designs. Every major page should use a global header, page header with title/context and filters, featured or hero content, reusable sections with headings and See all actions, and explicit loading/empty/error states. On mobile, the order is header, page title, horizontally scrollable pills, featured content, then vertical or horizontal cards and sections.

Reusable cards are required for Artist, Music, Event, Venue, and Ticket content. Artist cards use large imagery, verification badges, artist name, follower count, and optional Follow. Music cards use artwork, song, artist, album, play, optional like/more/duration. Event cards use image, status badge, favorite, title, date/time, venue, price, and ticket CTA. Venue cards use image, location, rating, and upcoming event count. Ticket cards use event image, event/ticket name, date/time, and View Ticket.

Pills are for classification/filtering, with compact rounded styling, selected state, and horizontal scrolling on mobile. Required filter families include discovery All/Artists/Music/Events/Venues; events All/Trending/Upcoming/Nearby/Popular; music All/Trending/New Releases/Liked; tickets Upcoming/Past; and status labels LIVE, UPCOMING, SOLD OUT, ENDED, CANCELLED, VERIFIED, TRENDING, POPULAR.

Artist pages should include a hero/profile treatment with cover, avatar, verified name, handle, followers, Follow/more, Music/Events/About tabs, popular music, upcoming events, and biography. Music pages should include large artwork, song/artist/album, progress, playback controls, Like/more, Artist, and More from this artist; the player should remain persistent where architecture supports it. Music Library uses All/Liked/Recently Played and desktop two-column versus mobile stacked layouts.

Event discovery should provide Featured Event, Trending, Upcoming, Near You, and Popular sections. Event Detail should emphasize conversion: hero image/status/favorite, date/time/venue, description, artists, venue, ticket options, and Get Tickets; mobile may use a sticky bottom CTA. Ticket flow must visibly progress Event Detail -> Select Ticket -> Quantity -> Order Summary -> Payment -> Payment Success -> Ticket Created -> Ticket Detail.

Continue reading the source file for the remaining directive sections before implementation; do not fabricate missing requirements. Preserve existing Preferences, Search History, notification persistence/read state, Support, authentication, and role dashboards.
