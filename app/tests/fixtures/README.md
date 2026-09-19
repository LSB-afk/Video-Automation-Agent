# Original media fixtures

`clip.mp4` (H.264 baseline) and `clip.webm` (VP8) are original generated test
videos: 30 frames at 25 fps, 64 × 36 pixels, alternating blue backgrounds with
a moving yellow stripe, no audio. They contain no course content or personal data.
Both are released under the repository's MIT license.

They were encoded with PyAV using `libx264` (baseline, CRF 30) and `libvpx`.
The fixtures are checked in so test execution needs no encoder, recording API,
network service, or installed Python package. Browsers choose an actually
supported codec through `HTMLMediaElement.canPlayType()`.

Tests wait for real playback and the native `ended` state. They never seek or
dispatch fabricated playback/completion events.
