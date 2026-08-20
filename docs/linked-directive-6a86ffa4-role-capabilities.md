# Atizzy Role-Capability Directive
Source: https://chatgpt.com/s/t_6a86ffa43cfc8191a4c35aba7c1dc30a

## Roles and abilities captured

Attendee / Normal User: discover artists, music, events, and venues; follow artists; like/save and play music; buy public tickets; access private tickets with organizer credentials; manage tickets, profile, preferences, and security; receive notifications; search/browse; participate in normal user activities.

Artist: manage owned artist profile, music, artwork/media, artist posts/content, applicable artist events, followers, artist analytics, and publishing activities. Authority is limited to owned artist resources.

Organizer: manage authorized events, event information, ticket types including public/private tickets, pricing, event attendees, event staff, event content, event sales/analytics, and event publishing.

Venue Manager: manage authorized venue profile, information, images/media, venue-related events, venue availability/details, and venue content. Authority is limited to authorized venue resources.

Event Staff: access assigned events, check in attendees, scan/validate tickets/QR codes, handle entry operations, and view operational attendee information required for the assignment. They must not edit events, change prices, manage users, or control other events automatically.

Admin: receives delegated administrative authorities from Super Admin; permissions may include user management, event management, ticket management, artist management, verification management, and moderation. Admin is not automatically unlimited; actual authority comes from delegated permissions.

Super Admin: complete authority over users, roles, permissions, artists, organizers, venues, event staff, events, music, content, tickets, orders, payments, verification, notifications, moderation, reports, platform policies, pricing, feature/workflow configuration, system settings, audit logs, and system health. Can create, view, edit, approve, verify, suspend, restore, archive, delete, configure, govern resources within safety/security architecture; delegate administrative authority; and inspect the system from different role perspectives.

Hierarchy: Super Admin -> Admin -> Artist / Organizer / Venue Manager / Event Staff / Attendee. The hierarchy is domain- and ownership-based, not merely a button count. Users may hold multiple roles/authorities, with Super Admin retaining the ultimate role when assigned.
