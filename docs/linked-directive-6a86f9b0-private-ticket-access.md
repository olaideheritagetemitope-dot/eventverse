# Linked Directive: Private Ticket Access

Source: https://chatgpt.com/s/t_6a86f9b08a8881919b28bdbe0dea1ddc

## Directive

Build a first-class ticket visibility and access system, not merely a different ticket label.

A public ticket is discoverable and purchasable by anyone meeting normal purchase conditions. A private ticket is not publicly discoverable and can only be discovered by someone with an organizer-provided access code, word, or combination. After access is unlocked, the user follows the normal ticket-detail, checkout, payment, and issued-ticket workflow.

The private-ticket code is an access key that unlocks ticket-type discovery; it is not the ticket itself.

## Acceptance checklist

- Inventory is enforced.
- Purchase limits are enforced.
- Expiration is enforced.
- Direct private-ticket URLs are protected.
- Global search does not expose private tickets.
- Brute-force protection exists.
- Organizer can manage private-ticket access.
- Admin permissions are respected.
- Super Admin has complete authority.
- Audit logging exists.
- Existing ticket UI remains intact.
- Existing ticket workflows remain intact.
- Mobile and desktop work correctly.
- Production build succeeds.
- Production deployment succeeds.

## Additional extracted directive content

The system must implement two distinct visibility/access types: public tickets and private tickets. This must be a real backend-enforced access system; private tickets must not be implemented merely by hiding them in the frontend.

Public tickets are available to normal event attendees and may appear in Event Detail, ticket listings, event discovery, search where appropriate, recommended/trending event flows, and public event pages. The normal workflow is Event → Event Detail → Tickets → Public Ticket Types → Select Ticket → Ticket Details → Quantity → Checkout → Payment → Ticket Issued. Public tickets follow the existing normal ticket-purchase rules.

Private tickets must be undiscoverable until an organizer-provided access code, word, or combination is successfully validated. The access key unlocks discovery of the ticket type; it is not the ticket itself. After unlocking, the user follows the normal ticket-detail, quantity, checkout, payment, and ticket-issued workflow.

## Further extracted directive content

Private tickets are restricted-access ticket types and must not appear in normal public ticket listings. They must not be discoverable by browsing the event, normally searching the event, viewing the public ticket list, guessing a ticket ID, manipulating frontend routes, or directly querying the frontend. The user must possess an organizer-provided access credential.

An organizer can create a credential consisting of a code, a word, or a code plus word. The organizer controls the credential. When creating or editing a ticket type, the UI must expose Ticket Visibility with Public and Private choices. Public continues normal creation. Private reveals Access Method options Code, Word, or Code + Word, followed by Access Credential and Confirm Credential, with optional expiration, maximum redemptions, maximum purchases per user, start date, and end date controls.

Private credentials must not be stored as plain text when secure hashing is available. The preferred design is a credential hash plus an appropriate secure lookup mechanism. Raw credentials must not be exposed through public API responses, and the frontend must never receive the complete private-ticket catalog merely because the event exists.

## Discovery and validation requirements

Create a dedicated private-ticket discovery interface such as “Have a private ticket code?” with an input and Find Ticket action. The user enters the organizer-supplied credential; the backend verifies it; a valid result returns only the authorized ticket information.

For CODE access, the user enters the configured code and the backend searches for the matching private-ticket access credential; if valid, display the matching private ticket. For WORD access, validate the supplied word and display the associated private ticket if valid. For CODE + WORD access, require both values and validate both; neither component alone may unlock the ticket.
