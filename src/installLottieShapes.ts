import type { graphic } from 'echarts';
import { rotate } from 'zrender/lib/core/matrix';
import { applyTransform } from 'zrender/lib/core/vector';
import { cubicLength, cubicSubdivide } from 'zrender/lib/core/curve';

function isAroundEqual(a: number[], b: number[]) {
  return Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8;
}

function getTransformMatrix(
  m: number[],
  x: number,
  y: number,
  rot: number,
  scaleX: number,
  scaleY: number,
  anchorX: number,
  anchorY: number
) {
  m[4] = -anchorX || 0;
  m[5] = -anchorY || 0;
  // scale
  m[0] = scaleX == null ? 1 : scaleX;
  m[3] = scaleY == null ? 1 : scaleY;
  mat[1] = mat[2] = 0;

  // Apply rotation
  rot && rotate(m, m, rot);

  // Translate back from origin and apply translation
  m[4] += x;
  m[5] += y;

  return m;
}

function transformPts(out: number[][], pts: number[][], transform: number[]) {
  for (let i = 0; i < pts.length; i++) {
    pts[i] = pts[i];
    out[i] = out[i] || [];
    applyTransform(out[i], pts[i], transform);
  }
}

interface ShapeRepeat {
  repeat: number;
  repeatX: number;
  repeatY: number;
  repeatRot: number;
  repeatScaleX: number;
  repeatScaleY: number;
  repeatAnchorX: number;
  repeatAnchorY: number;
}

const defaultShapeRepeat: ShapeRepeat = {
  repeat: 0,
  repeatX: 0,
  repeatY: 0,
  repeatRot: 0,
  repeatScaleX: 1,
  repeatScaleY: 1,
  repeatAnchorX: 0,
  repeatAnchorY: 0,
};

let mat: number[] = [];
function withRepeat(
  buildPath: (
    ctx: CanvasRenderingContext2D,
    shape: any,
    transform?: number[]
  ) => void,
  shape: ShapeRepeat & Record<string, any>,
  ctx: any
) {
  buildPath(ctx, shape, undefined);

  let x = 0;
  let y = 0;
  let rot = 0;
  let scaleX = 1;
  let scaleY = 1;
  for (let i = 0; i < shape.repeat; i++) {
    x += shape.repeatX;
    y += shape.repeatY;
    rot += shape.repeatRot;
    scaleX *= shape.repeatScaleX;
    scaleY *= shape.repeatScaleY;

    getTransformMatrix(
      mat,
      x,
      y,
      rot,
      scaleX,
      scaleY,
      shape.repeatAnchorX,
      shape.repeatAnchorY
    );

    buildPath(ctx, shape, mat);
  }
}

function eachSegment(
  inPts: number[][],
  outPts: number[][],
  vPts: number[][],
  close: boolean,
  drawSeg: (
    pt0: number[],
    pt1: number[],
    pt2?: number[],
    pt3?: number[]
  ) => void
) {
  const len = vPts.length;
  if (!len) {
    return;
  }

  for (let i = 1; i < len; i++) {
    const prev = i - 1;
    if (
      !isAroundEqual(outPts[prev], vPts[prev]) ||
      !isAroundEqual(inPts[i], vPts[i])
    ) {
      drawSeg(vPts[prev], outPts[prev], inPts[i], vPts[i]);
    } else {
      drawSeg(vPts[prev], vPts[i]);
    }
  }
  if (close) {
    const last = len - 1;
    if (
      !isAroundEqual(outPts[last], vPts[last]) ||
      !isAroundEqual(inPts[0], vPts[0])
    ) {
      drawSeg(vPts[last], outPts[last], inPts[0], vPts[0]);
    } else {
      drawSeg(vPts[last], vPts[0]);
    }
  }
}

function buildCustomPath(
  this: any,
  ctx: CanvasRenderingContext2D,
  shape: {
    in: number[][];
    out: number[][];
    v: number[][];
    close: boolean;
    trimStart: number;
    trimEnd: number;
  },
  transform?: number[]
) {
  let trimStart = shape.trimStart / 100;
  let trimEnd = shape.trimEnd / 100;

  if (trimStart === trimEnd) {
    return;
  }
  if (trimStart > trimEnd) {
    const tmp = trimStart;
    trimStart = trimEnd;
    trimEnd = tmp;
  }
  let inPts: number[][];
  let outPts: number[][];
  let vPts: number[][];
  if (transform) {
    inPts = (this as any)._inPts || ((this as any)._inPts = []);
    outPts = (this as any)._outPts || ((this as any)._outPts = []);
    vPts = (this as any)._vPts || ((this as any)._vPts = []);

    transformPts(inPts, shape.in, transform);
    transformPts(outPts, shape.out, transform);
    transformPts(vPts, shape.v, transform);
  } else {
    inPts = shape.in as number[][];
    outPts = shape.out as number[][];
    vPts = shape.v as number[][];
  }

  if (trimStart > 0 || trimEnd < 1) {
    let segLens: number[] = [];
    let totalLen = 0;
    // segLens = (this as any)._segLens || ((this as any)._segLens = []);
    let idx = 0;
    eachSegment(inPts, outPts, vPts, false, (pt0, pt1, pt2, pt3) => {
      const segLen =
        pt2 && pt3
          ? cubicLength(
              pt0[0],
              pt0[1],
              pt1[0],
              pt1[1],
              pt2[0],
              pt2[1],
              pt3[0],
              pt3[1],
              10
            )
          : Math.sqrt((pt0[0] - pt1[0]) ** 2 + (pt0[1] - pt1[1]) ** 2);
      segLens[idx++] = segLen;
      totalLen += segLen;
    });

    const trimedStartLen = trimStart * totalLen;
    const trimedEndLen = trimEnd * totalLen;
    let currLen = 0;
    let segIdx = 0;
    eachSegment(inPts, outPts, vPts, false, (pt0, pt1, pt2, pt3) => {
      const segLen = segLens[segIdx];

      // All trimed
      if (currLen + segLen <= trimedStartLen || currLen >= trimedEndLen) {
        return;
      } else if (
        // All not trimed
        currLen >= trimedStartLen &&
        currLen + segLen <= trimedEndLen
      ) {
        if (segIdx === 0) {
          ctx.moveTo(pt0[0], pt0[1]);
        }
        if (pt2 && pt3) {
          ctx.bezierCurveTo(pt1[0], pt1[1], pt2[0], pt2[1], pt3[0], pt3[1]);
        } else {
          ctx.lineTo(pt1[0], pt1[1]);
        }
      } else {
        const t0 = (trimedStartLen - currLen) / segLen;
        const t1 = (trimedEndLen - currLen) / segLen;
        if (t0 >= t1) {
          return;
        }
        let x0 = pt0[0];
        let y0 = pt0[1];
        let x1 = pt1[0];
        let y1 = pt1[1];
        // Partially trimmed
        if (pt2 && pt3) {
          let x2 = pt2[0];
          let y2 = pt2[1];
          let x3 = pt3[0];
          let y3 = pt3[1];
          const tmpX: number[] = [];
          const tmpY: number[] = [];
          if (t0 > 0) {
            // Trim start
            cubicSubdivide(x0, x1, x2, x3, t0, tmpX);
            cubicSubdivide(y0, y1, y2, y3, t0, tmpY);
            x0 = tmpX[4];
            y0 = tmpY[4];
            x1 = tmpX[5];
            y1 = tmpY[5];
            x2 = tmpX[6];
            y2 = tmpY[6];
            x3 = tmpX[7];
            y3 = tmpY[7];
          }
          if (t1 < 1) {
            // Trim end
            cubicSubdivide(x0, x1, x2, x3, t1, tmpX);
            cubicSubdivide(y0, y1, y2, y3, t1, tmpY);
            x0 = tmpX[0];
            y0 = tmpY[0];
            x1 = tmpX[1];
            y1 = tmpY[1];
            x2 = tmpX[2];
            y2 = tmpY[2];
            x3 = tmpX[3];
            y3 = tmpY[3];
          }

          ctx.moveTo(x0, y0);
          ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
        } else {
          if (t0 > 0) {
            x0 = (x1 - x0) * t0 + x0;
            y0 = (y1 - y0) * t0 + y0;
          }
          if (t1 < 1) {
            x1 = (x1 - x0) * t1 + x0;
            y1 = (y1 - y0) * t1 + y0;
          }
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
      }

      currLen += segLen;
      segIdx++;
    });
  } else {
    let isFirst = true;
    eachSegment(inPts, outPts, vPts, shape.close, (pt0, pt1, pt2, pt3) => {
      if (isFirst) {
        ctx.moveTo(pt0[0], pt0[1]);
      }
      if (pt2 && pt3) {
        ctx.bezierCurveTo(pt1[0], pt1[1], pt2[0], pt2[1], pt3[0], pt3[1]);
      } else {
        ctx.lineTo(pt1[0], pt1[1]);
      }
      isFirst = false;
    });
    if (shape.close) {
      ctx.closePath();
    }
  }
}

export function install(echarts: {
  graphic: Pick<typeof graphic, 'registerShape' | 'extendShape'>;
}) {
  const LottieShapePath = echarts.graphic.extendShape({
    type: 'lottie-shape-path',
    shape: {
      in: [] as number[][],
      out: [] as number[][],
      v: [] as number[][],
      close: false,
      trimStart: 0,
      trimEnd: 100,
      ...defaultShapeRepeat,
    },
    buildPath(ctx, shape: Record<string, any> & ShapeRepeat) {
      withRepeat(
        (ctx, shape, transform) => {
          buildCustomPath.call(this, ctx, shape, transform);
        },
        shape,
        ctx
      );
    },
  });

  const LottieShapeEllipse = echarts.graphic.extendShape({
    type: 'lottie-shape-ellipse',
    shape: {
      cx: 0,
      cy: 0,
      rx: 0,
      ry: 0,

      ...defaultShapeRepeat,
    },
    buildPath(ctx, shape: Record<string, any> & ShapeRepeat) {
      withRepeat(
        // TODO trim, transform repeat
        (ctx, shape) => {
          let x = shape.cx;
          let y = shape.cy;
          let a = shape.rx;
          let b = shape.ry;

          if (a === b) {
            // Is circle.
            ctx.arc(x, y, a, 0, Math.PI * 2);
            ctx.closePath();
          } else {
            const k = 0.5522848;
            const ox = a * k;
            const oy = b * k;
            ctx.moveTo(x - a, y);
            ctx.bezierCurveTo(x - a, y - oy, x - ox, y - b, x, y - b);
            ctx.bezierCurveTo(x + ox, y - b, x + a, y - oy, x + a, y);
            ctx.bezierCurveTo(x + a, y + oy, x + ox, y + b, x, y + b);
            ctx.bezierCurveTo(x - ox, y + b, x - a, y + oy, x - a, y);
            ctx.closePath();
          }
        },
        shape,
        ctx
      );
    },
  });

  const LottieShapeRect = echarts.graphic.extendShape({
    type: 'lottie-shape-rect',
    shape: {
      r: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,

      ...defaultShapeRepeat,
    },
    buildPath(ctx, shape: Record<string, any> & ShapeRepeat) {
      withRepeat(
        // TODO trim, transform repeat
        (ctx, shape) => {
          let width = shape.width;
          let height = shape.height;
          let x = shape.x - width / 2;
          let y = shape.y - height / 2;
          let r = shape.r;
          r = Math.min(width / 2, height / 2, r);
          if (!r) {
            ctx.rect(x, y, width, height);
          } else {
            // Convert width and height to positive for better borderRadius
            if (width < 0) {
              x = x + width;
              width = -width;
            }
            if (height < 0) {
              y = y + height;
              height = -height;
            }

            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
            ctx.lineTo(x + width, y + height - r);
            ctx.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
            ctx.lineTo(x + r, y + height);
            ctx.arc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
            ctx.lineTo(x, y + r);
            ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);

            ctx.closePath();
          }
        },
        shape,
        ctx
      );
    },
  });

  echarts.graphic.registerShape('lottie-shape-path', LottieShapePath);
  echarts.graphic.registerShape('lottie-shape-ellipse', LottieShapeEllipse);
  echarts.graphic.registerShape('lottie-shape-rect', LottieShapeRect);
}
