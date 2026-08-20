# Linked Directive: Atizzy Full Platform Control Plane

Source: https://chatgpt.com/s/t_6a86f2ae2dbc81919778cca99130fdae

## Mission

Transform the existing Admin/Super Admin system into a production-grade platform control plane. Authorized administrators must be able to control, configure, supervise, moderate, authorize, audit, and manage all legitimate roles, workflows, platform settings, feature availability, permissions, verification, assignments, content, notifications, payments, events, music, venues, tickets, and operational systems.

## Required audit areas

The directive explicitly requires an application-wide audit for visually present features that lack the underlying device or browser permission, Android/iOS permission, Supabase configuration, storage configuration, backend service, third-party provider, environment variable, RLS policy, notification infrastructure, location service, camera/scanner implementation, audio service, payment verification, or authentication configuration.

## Admin control-plane scope

The control plane must cover user and role administration, workflow supervision, moderation, authorization, verification, assignments, content, notifications, payments, events, music, venues, tickets, operational systems, platform settings, feature availability, and auditability.

## System Requirements / Health section

A visible Admin/Super Admin health section must show capability, status, and required action. The shared directive examples include Supabase, Google Auth, Spotify Auth, Storage, Push Notifications, notification permission, Camera, Location, QR Scanner, Payments, and Email. Status must distinguish connected/working/configured, configuration-needed, user/device-dependent, provider-pending, and not-operational states.

## Integration boundary rule

Payment integration boundaries should be built without inventing credentials. Once provider details are supplied, configuration should be attachable without restructuring the payment workflow.

## Acceptance intent

The final result must be a real control center rather than a statistics-only admin dashboard, with explicit visibility into missing integrations and required actions.
