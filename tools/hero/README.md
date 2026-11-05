# Hero clips

`assets/hero/hero.mp4` and `hero-mirror.mp4` are rendered from the source video by `relight.swift`. The source is a Veo clip of the head turning slowly, and only the first 2.25 s are used: front to profile.

```
swiftc -O relight.swift -o relight
./relight <source.mp4> ../../assets/hero/hero.mp4 ../../assets/hero/hero-mirror.mp4 [still.jpg]
```

What it does:
- Cuts the person out of each frame with Vision person segmentation.
- Relights them softly, keeping most of the real skin tone. A warm red key falls on the side the face turns toward, cool blue on the ear and the back of the head. It's even when facing front.
- Places them on the right of a generated blue scene with a red glow and embers.
- Writes every frame as a keyframe, so scrubbing `currentTime` with the pointer stays smooth.

The mirrored clip is the same lit person flipped, on the same scene, so both directions look alike and the hand-off at the front frame is seamless. `index.html` shows `hero.mp4` when the pointer is left of the face and `hero-mirror.mp4` when it is to the right.
