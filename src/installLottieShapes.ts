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

  for (let i = 1; i < vPts.length; i++) {
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
  },
  transform?: number[]
) {
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

  let segLens: number[];
  let totalLen = 0;
  if (shape.trimStart > 0) {
    segLens = (this as any)._segLens || ((this as any)._segLens = []);
    let idx = 0;
    eachSegment(inPts, outPts, vPts, shape.close, (pt0, pt1, pt2, pt3) => {
      const len =
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
      segLens[idx] = len;
      totalLen += len;
    });
  }

  const trimedLen = (shape.trimStart / 100) * totalLen;
  let segIdx = 0;
  let currLen = 0;
  eachSegment(inPts, outPts, vPts, shape.close, (pt0, pt1, pt2, pt3) => {
    if (trimedLen > 0) {
      const segLen = segLens[segIdx];
      let segTrimedLen = trimedLen - currLen;
      if (segTrimedLen >= segLen) {
        return;
      } else if (segTrimedLen > 0) {
        const t = segTrimedLen / segLen;
        if (pt2 && pt3) {
          const tmpX: number[] = [];
          const tmpY: number[] = [];
          cubicSubdivide(pt0[0], pt1[0], pt2[0], pt3[0], t, tmpX);
          cubicSubdivide(pt0[1], pt1[1], pt2[1], pt3[1], t, tmpY);
          ctx.moveTo(tmpX[4], tmpY[4]);
          ctx.bezierCurveTo(
            tmpX[5],
            tmpY[5],
            tmpX[6],
            tmpY[6],
            tmpX[7],
            tmpY[7]
          );
        } else {
          let x = (pt1[0] - pt0[0]) * t + pt0[0];
          let y = (pt1[1] - pt0[1]) * t + pt0[1];
          ctx.moveTo(x, y);
          ctx.lineTo(pt1[0], pt1[1]);
        }
      }
      currLen += segLen;
    } else {
      if (segIdx === 0) {
        ctx.moveTo(pt0[0], pt0[1]);
      }
    }
    if (pt2 && pt3) {
      ctx.bezierCurveTo(pt1[0], pt1[1], pt2[0], pt2[1], pt3[0], pt3[1]);
    } else {
      ctx.lineTo(pt1[0], pt1[1]);
    }
    segIdx++;
  });

  if (shape.close) {
    ctx.closePath();
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
      ...defaultShapeRepeat,
    },
    buildPath(ctx, shape: Record<string, any> & ShapeRepeat) {
      if (shape.trimStart === 100) {
        return;
      }
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
        (ctx, shape, transform) => {
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
        (ctx, shape, transform) => {
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
