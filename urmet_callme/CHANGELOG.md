# Changelog

## Unreleased

- **2Voice CallMe call-forwarding devices (1083/58A family)** - accounts whose cloud device list is
  empty now get a 2Voice place built from the instance SIP account. The station is taken from the SIP
  registration census and persisted, and door/gate open uses the `mac` header those devices require.
  Cloud-listed Ipercom and 2Voice systems keep the existing `auto_insertion` / `open_door_req` paths.

## 1.0.1

- **Fix camera video on some systems** - the image is back on Ubuntu 24.04. The 1.0.0 image moved to
  Debian, whose newer mediastreamer stack broke the video tap (the camera call connected but no frames
  reached go2rtc). Door-open/doorbell were unaffected.
- **Better diagnostics for unsupported models** - when an account returns no entrances, the log now
  shows the (secret-masked) shape of the cloud device response, so new models can be added.

## 1.0.0

Initial public release.

- **Door and gate unlock** for Ipercom panels - entrances are auto-discovered and exposed as Home
  Assistant `button` entities over MQTT (a press is a momentary strike release).
- **Doorbell events** - a `device_class: doorbell` event entity per panel that fires when it rings
  (requires the indoor monitor set to "remote").
- **2Voice support** - for non-Ipercom 2Voice systems, door/gate unlock plus a "ready" pre-warm
  button for an instant open, enabled automatically when a 2Voice system is detected.
- **Video (optional)** - one-way live video and audio from the entrance cameras, via an embedded
  liblinphone receiver + go2rtc, viewed with the WebRTC Camera card. One camera at a time.
- **Camera panel** in the Home Assistant sidebar (via ingress): the live go2rtc camera view when
  video is enabled; blank otherwise.
