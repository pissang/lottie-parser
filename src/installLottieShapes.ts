import type { graphic } from 'echarts';
import { rotate } from 'zrender/lib/core/matrix';
import { applyTransform } from 'zrender/lib/core/vector';

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
      trim: 0,
      ...defaultShapeRepeat,
    },
    buildPath(ctx, shape: Record<string, any> & ShapeRepeat) {
      withRepeat(
        (ctx, shape, transform) => {
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

          const len = vPts.length;
          if (!len) {
            return;
          }
          ctx.moveTo(vPts[0][0], vPts[0][1]);
          for (let i = 1; i < len; i++) {
            const prev = i - 1;
            if (
              !isAroundEqual(outPts[prev], vPts[prev]) ||
              !isAroundEqual(inPts[i], vPts[i])
            ) {
              ctx.bezierCurveTo(
                outPts[prev][0],
                outPts[prev][1],
                inPts[i][0],
                inPts[i][1],
                vPts[i][0],
                vPts[i][1]
              );
            } else {
              ctx.lineTo(vPts[i][0], vPts[i][1]);
            }
          }

          if (shape.close) {
            const last = len - 1;
            if (
              !isAroundEqual(outPts[last], vPts[last]) ||
              !isAroundEqual(inPts[0], vPts[0])
            ) {
              ctx.bezierCurveTo(
                outPts[last][0],
                outPts[last][1],
                inPts[0][0],
                inPts[0][1],
                vPts[0][0],
                vPts[0][1]
              );
            } else {
              ctx.closePath();
            }
          }
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
