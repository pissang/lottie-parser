import type { graphic } from 'echarts';

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
    },
    buildPath(ctx, shape) {
      const inPts = shape.in as number[][];
      const outPts = shape.out as number[][];
      const vPts = shape.v as number[][];

      const len = vPts.length;
      if (!len) {
        return;
      }
      ctx.moveTo(vPts[0][0], vPts[0][1]);
      for (let i = 1; i < len; i++) {
        const prev = i - 1;
        if (inPts[i][0] || inPts[i][1] || outPts[prev][0] || outPts[prev][1]) {
          ctx.bezierCurveTo(
            vPts[prev][0] + outPts[prev][0],
            vPts[prev][1] + outPts[prev][1],
            vPts[i][0] + inPts[i][0],
            vPts[i][1] + inPts[i][1],
            vPts[i][0],
            vPts[i][1]
          );
        } else {
          ctx.lineTo(vPts[i][0], vPts[i][1]);
        }
      }

      if (shape.close) {
        const last = len - 1;
        if (inPts[0][0] || inPts[0][1] || outPts[last][0] || outPts[last][1]) {
          ctx.bezierCurveTo(
            vPts[last][0] + outPts[last][0],
            vPts[last][1] + outPts[last][1],
            vPts[0][0] + inPts[0][0],
            vPts[0][1] + inPts[0][1],
            vPts[0][0],
            vPts[0][1]
          );
        } else {
          ctx.closePath();
        }
      }
    },
  });

  const LottieShapeEllipse = echarts.graphic.extendShape({
    type: 'lottie-shape-ellipse',
    shape: {
      cx: 0,
      cy: 0,
      rx: 0,
      ry: 0,
    },
    buildPath(ctx, shape) {
      const x = shape.cx;
      const y = shape.cy;
      const a = shape.rx;
      const b = shape.ry;

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
  });

  echarts.graphic.registerShape('lottie-shape-path', LottieShapePath);
  echarts.graphic.registerShape('lottie-shape-ellipse', LottieShapeEllipse);
}
