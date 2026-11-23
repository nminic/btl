import { inflateSync } from 'node:zlib'

/**
 * THE PIXELS OF A SCREENSHOT, for the one guard that has to ask what colour something was DRAWN in
 * (`dropdownArrowForced.geometry.ts`: under forced colors a computed style says what was asked and not what the
 * system painted). Playwright hands a PNG and the repository carries no image library, so this reads the one
 * shape Chrome writes: 8 bits a channel, RGB or RGBA, no interlacing. Anything else throws, so a screenshot in
 * another shape is never read as a picture of nothing.
 */
export type Pixels = { width: number; height: number; at: (x: number, y: number) => [number, number, number] }

export function readPng(png: Buffer): Pixels {
  if (png.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('NOT MEASURED: the screenshot is not a PNG')
  }

  let offset = 8
  let width = 0
  let height = 0
  let channels = 0
  const data: Buffer[] = []

  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const kind = png.toString('ascii', offset + 4, offset + 8)
    const body = png.subarray(offset + 8, offset + 8 + length)

    if (kind === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const depth = body[8]
      const type = body[9]
      const interlaced = body[12]

      if (depth !== 8 || interlaced !== 0 || (type !== 2 && type !== 6)) {
        throw new Error(`NOT MEASURED: a PNG of depth ${String(depth)}, type ${String(type)}, interlace ${String(interlaced)}`)
      }

      channels = type === 2 ? 3 : 4
    } else if (kind === 'IDAT') {
      data.push(body)
    }

    offset += 12 + length
  }

  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const out = Buffer.alloc(stride * height)

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)]
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1))

    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? (out[row * stride + index - channels] ?? 0) : 0
      const up = row > 0 ? (out[(row - 1) * stride + index] ?? 0) : 0
      const upLeft = row > 0 && index >= channels ? (out[(row - 1) * stride + index - channels] ?? 0) : 0
      const value = line[index] ?? 0
      let predictor = 0

      if (filter === 1) {
        predictor = left
      } else if (filter === 2) {
        predictor = up
      } else if (filter === 3) {
        predictor = Math.floor((left + up) / 2)
      } else if (filter === 4) {
        const guess = left + up - upLeft
        const toLeft = Math.abs(guess - left)
        const toUp = Math.abs(guess - up)
        const toUpLeft = Math.abs(guess - upLeft)

        predictor = toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft
      }

      out[row * stride + index] = (value + predictor) & 0xff
    }
  }

  return {
    width,
    height,
    at: (x, y) => {
      const start = y * stride + x * channels

      return [out[start] ?? 0, out[start + 1] ?? 0, out[start + 2] ?? 0]
    },
  }
}
