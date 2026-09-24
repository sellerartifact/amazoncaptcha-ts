# amazoncaptcha-ts

English| [简体中文](./README-CN.md)

A pure Node.js + TypeScript port of [`a-maliarov/amazoncaptcha`](https://github.com/a-maliarov/amazoncaptcha) — a lightweight solver for [Amazon's text captcha](https://www.amazon.com/errors/validateCaptcha).

This monorepo provides two complementary approaches:

- **`amazoncaptcha`** — Fast fingerprint matching (no neural networks, no native bindings). Just image thresholding, column-scanning segmentation, and an exact pixel-fingerprint lookup table — the same trick the original Python library uses, reimplemented on top of [`jimp`](https://github.com/jimp-dev/jimp) so it runs anywhere Node.js does.
- **`amazoncaptcha-tfjs`** — CNN-based deep learning solver using TensorFlow.js. Better generalization on unseen font variations with **100% accuracy** on test data.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%5E20.19.0%20%7C%7C%20%3E%3D22.12.0-brightgreen.svg)
![Built with Rslib](https://img.shields.io/badge/built%20with-Rslib-orange.svg)
![Tested with Rstest](https://img.shields.io/badge/tested%20with-Rstest-orange.svg)

## Why this exists

Amazon's captcha is a weak, fixed-format one: 6 lowercase letters, a small set of fonts, no rotation or heavy distortion — just occasional letter overlap and image cropping artifacts. Because of that, the same exact-fingerprint-matching trick the Python original pioneered works extremely well without any machine learning, and this port keeps that philosophy intact rather than reaching for a heavier solution than the problem needs.

## How it works

The pipeline mirrors the original Python implementation step for step:

1. **Threshold to monochrome** — convert to grayscale, then force every pixel to pure black or pure white using a low luminance threshold. This strips background gradients and noise, leaving only the letter strokes.
2. **Segment letters by column scan** — walk the image column by column and group contiguous columns that contain black pixels into letter boxes.
   - A box that's too wide is treated as two letters glued together; the algorithm finds the column with the fewest black pixels in the middle of the box and splits there.
   - If segmentation produces 7 boxes instead of 6, it means the image was cropped mid-letter and wrapped the last letter's tail to the front — the last and first boxes are merged back together.
   - Any other letter count, or a suspiciously narrow first letter, is treated as a failed segmentation.
3. **Trim whitespace** — crop each letter box down to its tightest bounding content.
4. **Generate a pixel fingerprint** — walk each letter's pixels in row-major order and encode black/white as a `1`/`0` bit string.
5. **Exact lookup** — look the fingerprint up in a precomputed table of every previously seen variant of each letter. A hit resolves the letter; if any of the 6 letters misses, the whole captcha is reported as unsolved rather than guessed at.

No confidence scores, no nearest-neighbor guessing by default — a match is either exact or the result is `'Not solved'`, same contract as the original library.

## Installation

### Traditional Fingerprint Matching (Fast)

```bash
pnpm add amazoncaptcha
# or: npm install amazoncaptcha
```

### Deep Learning with TensorFlow.js (Better Generalization)

```bash
pnpm add amazoncaptcha-tfjs amazoncaptcha
# or: npm install amazoncaptcha-tfjs amazoncaptcha
```

## Usage

### Traditional Approach (Fingerprint Matching)

```ts
import { solve } from "amazoncaptcha";

const solution = await solve("./captcha.jpg");
// 'krjnby' | 'Not solved'
```

`solve()` accepts a file path or an in-memory `Buffer`, so it works equally well reading a saved image or a captcha screenshot/response body you already have in memory.

### Deep Learning Approach (CNN)

```ts
import { solve } from "amazoncaptcha-tfjs";

const solution = await solve("./captcha.jpg");
// 'krjnby' | 'Not solved'

// With custom confidence threshold (default: 0.5)
const solution = await solve("./captcha.jpg", 0.8);
```

**Performance comparison:**

| Method | Accuracy | Speed | Model Size | Generalization |
|--------|----------|-------|------------|----------------|
| Fingerprint matching | ~95% | ~10ms | ~MB | Low (exact match only) |
| CNN (TensorFlow.js) | **100%** | ~100ms | **~417KB** | High (handles variations) |

See [`packages/amazoncaptcha-tfjs`](./packages/amazoncaptcha-tfjs) for detailed documentation on training your own model.

## Training data

Letter recognition relies on a fingerprint table built from real captcha samples, sourced from the Python project's companion dataset, [`amazon-captcha-database`](https://github.com/a-maliarov/amazon-captcha-database). Because that dataset stores each fingerprint as a `zlib`-compressed Python `bytes` repr string, it isn't directly usable from Node — `scripts/convert_training_data.py` does a one-time conversion into a flat, uncompressed `fingerprint -> letter` JSON map that the solver loads at runtime.

If you're regenerating the table from an updated copy of the Python dataset:

```bash
python scripts/convert_training_data.py <path-to-training_data> packages/amazoncaptcha/src/training_data/fingerprints.json
```

## How this differs from the Python and Rust versions

This port deliberately borrows different things from each of its two predecessors rather than following either one exactly:

|                                | Python (`amazoncaptcha`)                | Rust (`amazoncaptcha-rs`)              | This port                                                                                                                                    |
| ------------------------------ | --------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Letter overlap splitting       | ✅                                      | ❌                                     | ✅ (kept — skipping this measurably hurts accuracy)                                                                                          |
| Whitespace trimming per letter | ✅                                      | ❌                                     | ✅ (kept — reduces fingerprint variance)                                                                                                     |
| Fingerprint storage            | per-letter `zlib`-compressed JSON files | single uncompressed `HashMap`          | single uncompressed flat map (Rust's structure, faster to load, simpler to reason about)                                                     |
| No-exact-match behavior        | returns `'Not solved'`                  | falls back to a nearest-neighbor guess | returns `'Not solved'` (Python's conservative default — callers who want a best-effort guess can layer their own similarity fallback on top) |

## Project structure

```
.
├── package.json            # workspace root (private)
├── pnpm-workspace.yaml     # packages/*
├── tsconfig.base.json      # shared compiler options
└── packages/
    ├── amazoncaptcha/      # Traditional fingerprint matching
    │   ├── rslib.config.ts
    │   ├── rstest.config.ts
    │   ├── src/
    │   │   ├── index.ts         # public entry (exports `solve`)
    │   │   └── training_data/   # fingerprints.json lookup table
    │   ├── tests/
    │   └── dist/            # build output (git-ignored)
    └── amazoncaptcha-tfjs/ # CNN-based deep learning solver
        ├── src/
        │   ├── index.ts         # public entry
        │   ├── model.ts         # CNN model definition
        │   ├── predict.ts       # inference logic
        │   └── preprocessing.ts # image preprocessing
        ├── models/
        │   └── captcha_model/   # trained model (~417KB)
        ├── scripts/
        │   ├── train_model.ts   # model training
        │   └── evaluate_model.ts # accuracy evaluation
        ├── tests/               # 29 test cases
        └── dist/
```

## Development

Requirements: Node.js `^20.19.0 || >=22.12.0`, pnpm 12.

Run from the repository root:

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `pnpm install`       | Install dependencies for all packages |
| `pnpm run build`     | Build every package                   |
| `pnpm run dev`       | Watch mode for `amazoncaptcha`        |
| `pnpm run test`      | Run tests in every package            |
| `pnpm run typecheck` | Type-check every package              |

Target a single package with `--filter`:

```bash
pnpm --filter amazoncaptcha run build
pnpm --filter amazoncaptcha run test
```

### Adding a package

Create `packages/<name>/`, add its `package.json`, and extend the shared config:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src"]
}
```

`pnpm-workspace.yaml` already globs `packages/*`, so no registration is needed.

## Testing

The `amazoncaptcha` package's test suite is ported from the Python original's [`tests/test_main.py`](https://github.com/a-maliarov/amazoncaptcha/blob/master/tests/test_main.py), covering:

- a clean, non-overlapping captcha
- an image cropped mid-letter that requires merging the last and first segments back together
- overlapping/glued letters that require mid-box splitting
- a captcha with both problems at once
- captchas that can't be segmented or matched at all, asserting the `'Not solved'` fallback

## Disclaimer

This project is for educational and research purposes only. Any use of this code is solely your responsibility. Amazon is a registered trademark of Amazon.com, Inc.; this project is not affiliated with or endorsed by Amazon.com, Inc.

## Acknowledgements

This project would not exist without:

- **[a-maliarov/amazoncaptcha](https://github.com/a-maliarov/amazoncaptcha)** — the original Python solver. The entire segmentation and fingerprinting algorithm, and the training dataset this port's lookup table is built from, come from this project. Full credit for the core idea goes here.
- **[vlourme/amazoncaptcha-rs](https://github.com/vlourme/amazoncaptcha-rs)** — a Rust port whose simpler, single-flat-map storage format and no-guessing-vs-fallback design trade-offs directly shaped a few of the decisions in this implementation.

If you're doing ML/neural-network work on this problem instead, the Python project's [`amazon-captcha-database`](https://github.com/a-maliarov/amazon-captcha-database) is also the right place to find labeled samples.

## License

[MIT](./LICENSE)
