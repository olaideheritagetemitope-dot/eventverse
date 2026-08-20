# Atizzy Camera Preview Persistence Fix

## Reported behavior

The phone camera indicator remained active, but the QR scanner preview stopped rendering after a short period. This indicated that the MediaStream remained live while the rendered video element was detached, paused, or no longer receiving the stream.

## Root cause

The scanner requested a MediaStream and then immediately called ZXing's device-oriented decoder while the React video element was conditionally mounting. The stream was not explicitly attached to the rendered `<video>` element before decoding began. The scanner also had no recovery path when the video element paused, emitted `stalled`/`emptied`, or lost its `srcObject`.

## Implemented fix

`src/components/CheckInScreen.jsx` now waits for the video element to mount, explicitly assigns the exact `MediaStream` to `video.srcObject`, enables muted inline autoplay, and calls `video.play()` before starting ZXing decoding. Decoding now uses `decodeFromStream(stream, video, callback)`, ensuring the decoder and visible preview use the same active stream.

The scanner registers recovery listeners for `loadedmetadata`, `canplay`, `stalled`, `emptied`, and `pause`. A lightweight health interval checks the stream attachment and playback state every 1.2 seconds while the scanner is active and reattaches or resumes playback when necessary. Cleanup clears the interval, removes listeners, stops decoder controls, resets the reader, stops camera tracks, pauses the video, and clears `srcObject`.

A ref-backed scan-enabled state prevents asynchronous decoder and recovery callbacks from reading stale React state after the scanner toggle changes.

## Validation

TypeScript validation passed. The focused camera and QR directive suites passed with 7 tests. The complete Atizzy suite passed with 39 test files and 136 passing tests, with 2 credential-dependent tests skipped. The Vite production build passed; only the existing large-chunk advisory remains.

## Scope preserved

The existing Atizzy scanner layout, camera/picture modes, continuous scanning controls, backend-authoritative validation, event assignment scope, explicit ticket result states, and cleanup behavior were preserved. No mock data or alternate ticket-validation path was introduced.
