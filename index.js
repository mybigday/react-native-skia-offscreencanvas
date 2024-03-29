import {
  Skia,
  matchFont,
  ColorType,
  AlphaType,
  PaintStyle,
  rect,
} from '@shopify/react-native-skia'
import { EventEmitter } from 'tseep'

export class Image extends EventEmitter {
  constructor(width, height) {
    super()
    this.width = width
    this.height = height
    this._onload = null
    this._onerror = null
    this._src = null
    this._image = null
  }

  set onload(value) {
    if (this._onload) {
      this.removeListener('load', this._onload)
    }
    this._onload = value
    if (this._onload) {
      if (this._image) {
        this._onload()
      } else {
        this.addListener('load', this._onload)
      }
    }
  }

  get onload() {
    return this._onload
  }

  set onerror(value) {
    if (this._onerror) {
      this.removeListener('error', this._onerror)
    }
    this._onerror = value
    if (this._onerror) {
      this.addListener('error', this._onerror)
    }
  }

  get onerror() {
    return this._onerror
  }

  set src(value) {
    this._src = value
    this._load()
  }

  get src() {
    return this._src
  }

  async _load() {
    if (this._src) {
      try {
        const data = await Skia.Data.fromURI(this._src)
        this._image = Skia.Image.MakeImageFromEncoded(data)
        data.dispose()
        if (!this.width) {
          this.width = this._image.width()
        }
        if (!this.height) {
          this.height = this._image.height()
        }
        this.emit('load')
      } catch (err) {
        this.emit('error', err)
      }
    } else {
      this._image?.dispose()
      this._image = null
      this.width = 0
      this.height = 0
    }
  }
}

export class ImageData {
  constructor(arg0, arg1, arg2) {
    if (typeof arg0 === 'number') {
      this.width = arg0
      this.height = arg1
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    } else {
      this.width = arg1
      this.height = arg2
      this.data = arg0
    }
  }
}

const getImageInfo = (width, height) => ({
  width,
  height,
  colorType: ColorType.RGBA_8888,
  alphaType: AlphaType.Unpremul,
})

const getFont = (font) => {
  const match = font?.match(/(?:(\w+) )?(\d+)(px|pt) (.*)/)
  if (match) {
    let size = parseInt(match[2])
    if (match[3] === 'pt') {
      size = Math.round(size * 1.3333333333333333)
    }
    return matchFont({
      fontFamily: match[3],
      fontWeight: match[1] ?? 'normal',
      fontSize: size,
    })
  } else {
    return matchFont({ fontSize: 10 })
  }
}

const getPaint = (style, color, lineWidth=0) => {
  const paint = Skia.Paint()
  if (style !== undefined) {
    paint.setStyle(style)
  }
  if (color) {
    paint.setColor(Skia.Color(color))
  }
  if (lineWidth && style === PaintStyle.Stroke) {
    paint.setStrokeWidth(lineWidth)
  }
  return paint
}

class CanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas
    this._ctx = canvas.surface.getCanvas()
    this.lineWidth = 1
    this.strokeStyle = '#000000'
    this.fillStyle = '#000000'
    this.font = '10px sans-serif'
  }

  putImageData(imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight) {
    const { data, width, height } = imageData
    const skData = Skia.Data.fromBytes(data)
    const image = Skia.Image.MakeImage(getImageInfo(width, height), skData, 4 * width)
    skData.dispose()
    if (arguments.length === 3) {
      this._ctx.drawImage(image, dx, dy)
    } else {
      this._ctx.drawImageRect(
        image,
        {
          x: dirtyX,
          y: dirtyY,
          width: dirtyWidth,
          height: dirtyHeight
        },
        {
          x: dx,
          y: dy,
          width: dirtyWidth,
          height: dirtyHeight
        },
        getPaint(),
      )
    }
    image.dispose()
  }

  getImageData(sx=0, sy=0, sw, sh) {
    const width = sw ?? this.canvas.width
    const height = sh ?? this.canvas.height
    const pixels = this._ctx.readPixels(sx, sy, getImageInfo(width, height), undefined, 4 * width)
    return new ImageData(pixels, width, height)
  }

  drawImage(image, ...args) {
    let img
    let width
    let height
    if (image._image) {
      img = image._image
      width = image.width
      height = image.height
    } else if (image.surface) {
      img = image.surface.makeImageSnapshot()
      width = image.width
      height = image.height
    } else {
      throw new Error('Invalid image')
    }
    if (args.length === 2) {
      const [dx, dy] = args
      this._ctx.drawImage(img, dx, dy)
    } else if (args.length === 4) {
      const [dx, dy, dw, dh] = args
      this._ctx.drawImageRect(
        img,
        {
          x: 0,
          y: 0,
          width,
          height
        },
        {
          x: dx,
          y: dy,
          width: dw,
          height: dh
        },
        getPaint(),
      )
    } else {
      const [sx, sy, sw, sh, dx, dy, dw, dh] = args
      this._ctx.drawImageRect(
        img,
        {
          x: sx,
          y: sy,
          width: sw,
          height: sh
        },
        {
          x: dx,
          y: dy,
          width: dw,
          height: dh
        },
        getPaint(),
      )
    }
    if (image.surface) {
      img.dispose()
    }
  }

  fillText(text, x, y, maxWidth) {
    const font = getFont(this.font)
    const paint = getPaint(PaintStyle.Fill, this.fillStyle)
    this._ctx.drawText(text, x, y, font, paint)
    font.dispose()
    paint.dispose()
  }

  strokeText(text, x, y, maxWidth) {
    const font = getFont(this.font)
    const paint = getPaint(PaintStyle.Stroke, this.strokeStyle, this.lineWidth)
    this._ctx.drawText(text, x, y, font, paint)
    font.dispose()
    paint.dispose()
  }

  beginPath() {
    this._mode = 'path'
    this._path = Skia.Path.Make()
  }

  moveTo(x, y) {
    this._path?.moveTo(x, y)
  }

  lineTo(x, y) {
    this._path?.lineTo(x, y)
  }

  closePath() {
    this._path?.close()
  }

  rect(x, y, w, h) {
    this._mode = 'rect'
    this._rect = rect(x, y, w, h)
  }

  _draw(style) {
    const paint = getPaint(
      style,
      style === PaintStyle.Stroke ? this.strokeStyle : this.fillStyle,
      this.lineWidth
    )
    switch (this._mode) {
      case 'rect':
        this._ctx.drawRect(this._rect, paint)
        this._rect.dispose()
        break
      case 'path':
        this._ctx.drawPath(this._path, paint)
        this._path.dispose()
        break
    }
    this._mode = null
    this._rect = null
    this._path = null
    paint.dispose()
  }

  stroke() {
    this._draw(PaintStyle.Stroke)
  }

  fill() {
    this._draw(PaintStyle.Fill)
  }

  fillRect(x, y, w, h) {
    this._ctx.drawRect(rect(x, y, w, h), getPaint(PaintStyle.Fill, this.fillStyle))
  }

  save() {
    this._ctx.save()
  }

  restore() {
    this._ctx.restore()
  }

  dispose() {
    this._ctx.dispose()
  }
}

export class OffscreenCanvas {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.surface = Skia.Surface.MakeOffscreen(width, height)
  }

  transferToImageBitmap() {
    throw new Error('Method not implemented.')
  }

  addEventListener(type, listener, options) {
    throw new Error('Method not implemented.')
  }

  removeEventListener(type, listener, options) {
    throw new Error('Method not implemented.')
  }

  dispatchEvent(event) {
    throw new Error('Method not implemented.')
  }

  getContext(ctx) {
    if (ctx === '2d') {
      return new CanvasRenderingContext2D(this)
    }
    return null
  }

  dispose() {
    this.surface.dispose()
  }
}
