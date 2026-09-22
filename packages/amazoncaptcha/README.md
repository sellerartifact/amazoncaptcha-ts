# amazoncaptcha

A pure Node.js + TypeScript port of [`a-maliarov/amazoncaptcha`](https://github.com/a-maliarov/amazoncaptcha) — a lightweight solver for [Amazon's text captcha](https://www.amazon.com/errors/validateCaptcha).

No OCR engines, no neural networks, no native bindings. Just image thresholding, column-scanning segmentation, and an exact pixel-fingerprint lookup table, built on top of [`jimp`](https://github.com/jimp-dev/jimp).

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%5E20.19.0%20%7C%7C%20%3E%3D22.12.0-brightgreen.svg)

## Installation

```bash
npm install amazoncaptcha
# or: pnpm add amazoncaptcha
# or: yarn add amazoncaptcha
```

## Usage

```ts
import { solve } from "amazoncaptcha";

const solution = await solve("./captcha.jpg");
// 'krjnby' | 'Not solved'
```

`solve()` also accepts an in-memory `Buffer`, so it works directly on a captcha response body without writing anything to disk first:

```ts
import { solve } from "amazoncaptcha";

const response = await fetch(captchaImageUrl);
const buffer = Buffer.from(await response.arrayBuffer());

const solution = await solve(buffer);
```

## API

### `solve(source: string | Buffer): Promise<string>`

Resolves a captcha image to its 6-letter solution.

| Parameter | Type               | Description                                        |
| --------- | ------------------ | -------------------------------------------------- |
| `source`  | `string \| Buffer` | Path to a local image, or the image bytes directly |

**Returns** a lowercase 6-character string on success, or the literal string `'Not solved'` if any letter can't be matched exactly.

**Throws** only if the image itself can't be decoded (corrupted file, unsupported format, etc.) — it does not throw for a captcha it simply fails to recognize; that's always the `'Not solved'` return value, never an exception. Wrap calls in `try/catch` if you can't guarantee the input is a well-formed image.

## How it works

1. Threshold the image to pure black/white to strip background noise.
2. Scan columns to segment individual letters, splitting glued-together letters and re-merging letters that got wrapped around a cropped image edge.
3. Trim each letter to its tightest bounding box.
4. Encode each letter's pixels into a black/white bit-string fingerprint.
5. Look the fingerprint up in a precomputed table; only an exact match counts.

For the full breakdown (and how this compares to the original Python and Rust implementations), see the [repository README](https://github.com/sellerartifact/amazoncaptcha-ts#how-it-works).

## Accuracy notes

Recognition quality depends entirely on how many fingerprint variants the lookup table has seen for each letter — this is a lookup-table matcher, not a model that generalizes to unseen renderings. If you start seeing an unusual number of `'Not solved'` results, it likely means Amazon's captcha rendering has drifted and the training data needs refreshing from an updated sample set, not a bug in the segmentation logic.

## Requirements

Node.js `^20.19.0 || >=22.12.0`.

## Contributing / development setup

This package lives inside the [`amazoncaptcha-ts`](https://github.com/sellerartifact/amazoncaptcha-ts) pnpm workspace monorepo. For build/test/dev commands and the overall repo layout, see the [root README](https://github.com/sellerartifact/amazoncaptcha-ts).

## Disclaimer

This project is for educational and research purposes only. Any use of this code is solely your responsibility. Amazon is a registered trademark of Amazon.com, Inc.; this project is not affiliated with or endorsed by Amazon.com, Inc.

## Acknowledgements

- **[a-maliarov/amazoncaptcha](https://github.com/a-maliarov/amazoncaptcha)** — the original Python solver this package is ported from; the segmentation algorithm and training data both trace back here.
- **[vlourme/amazoncaptcha-rs](https://github.com/vlourme/amazoncaptcha-rs)** — a Rust port whose storage format shaped this implementation's lookup table design.

## License

[MIT](../../LICENSE)
