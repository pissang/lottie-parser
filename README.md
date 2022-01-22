# Lottie Parser

Parsing lottie files and display it in the Apache ECharts.

## Install

```bash
npm i lottie-parser
```

## Basic Usage

```ts
import * as lottieParser from 'lottie-parser';
import * as echarts from 'echarts';

// Install required shapes to echarts
lottieParser.install(echarts);

const chart = echarts.init(dom);

fetch(`lottie.json`)
  .then((response) => response.json())
  .then((data) => {
    const { elements, width, height } = lottieParser.parse(data, {
      // 循环播放动画
      loop: true,
    });

    // Scale to 400px
    const scale = 400 / Math.min(width, height);

    chart.setOption({
      graphic: {
        elements: [
          {
            type: 'group',
            scaleX: scale,
            scaleY: scale,
            // Elements is compatitable with echarts graphic.
            children: elements,
          },
        ],
      },
    });
  });
```

## Limitations

- Expressions are not supported
- Text and image layers are not supported
- Repeat on the rect and ellipsis doesn't support trim yet.
- Gradient animation is not supported.

Some other unknown issues can be reported in the issue.
