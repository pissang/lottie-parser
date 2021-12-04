import type { graphic } from 'echarts';

export function install(echarts: {
  graphic: Pick<typeof graphic, 'registerShape' | 'extendShape'>;
}) {
  const shape = echarts.graphic.extendShape({
    type: 'lottie-shape',
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
        ctx.bezierCurveTo(
          vPts[prev][0] + outPts[prev][0],
          vPts[prev][1] + outPts[prev][1],
          vPts[i][0] + inPts[i][0],
          vPts[i][1] + inPts[i][1],
          vPts[i][0],
          vPts[i][1]
        );
      }

      if (shape.close) {
        ctx.bezierCurveTo(
          vPts[len - 1][0] + outPts[len - 1][0],
          vPts[len - 1][1] + outPts[len - 1][1],
          vPts[0][0] + inPts[0][0],
          vPts[0][1] + inPts[0][1],
          vPts[0][0],
          vPts[0][1]
        );
      }
    },
  });

  echarts.graphic.registerShape('lottie-shape', shape);
}
