import * as lottieParser from '../src/main';
import * as echarts from 'echarts';

lottieParser.install(echarts);

let chart = echarts.init(document.getElementById('chart'));

Promise.all([
  fetch(`./data/rocket-lunch.json`).then((response) => response.json()),
  fetch(`./asset/Map_of_Iceland.svg`).then((response) => response.text()),
]).then(([lottieData, svgData]) => {
  const result = lottieParser.parse(lottieData, {
    loop: true,
  });
  echarts.registerMap('iceland_svg', {
    svg: svgData,
  });

  chart.setOption({
    geo: {
      tooltip: {
        show: true,
      },
      map: 'iceland_svg',
      top: 0,
      bottom: 0,
      roam: true,
    },
    series: {
      type: 'custom',
      coordinateSystem: 'geo',
      geoIndex: 0,
      zlevel: 1,
      data: [
        [488.2358421078053, 459.70913833075736, 100],
        [770.3415644319939, 757.9672194986475, 30],
        [1180.0329284196291, 743.6141808346214, 80],
        [894.03790632245, 1188.1985153835008, 61],
        [1372.98925630313, 477.3839988649537, 70],
        [1378.62251255796, 935.6708486282843, 81],
      ],
      renderItem(params, api) {
        const coord = api.coord([
          api.value(0, params.dataIndex),
          api.value(1, params.dataIndex),
        ]);
        const size = 100;
        const scale = Math.min(size / result.width, size / result.height);

        const circles = [];
        for (let i = 0; i < 5; i++) {
          circles.push({
            type: 'circle',
            silent: true,
            shape: {
              cx: 0,
              cy: 0,
              r: 100,
            },
            style: {
              fill: 'red',
              lineWidth: 2,
            },
            // Ripple animation
            keyframeAnimation: {
              duration: 4000,
              loop: true,
              delay: (-i / 4) * 4000,
              keyframes: [
                {
                  percent: 0,
                  scaleX: 0,
                  scaleY: 0,
                  style: {
                    opacity: 1,
                  },
                },
                {
                  percent: 1,
                  scaleX: 1,
                  scaleY: 0.4,
                  style: {
                    opacity: 0,
                  },
                },
              ],
            },
          });
        }
        return {
          type: 'group',
          x: coord[0],
          y: coord[1],
          children: [
            ...circles,
            {
              type: 'group',
              scaleX: scale,
              scaleY: scale,
              anchorX: result.width / 2,
              anchorY: result.height,
              keyframeAnimation: {
                duration: 5000,
                delay: -Math.random() * 5000,
                loop: true,
                keyframes: [
                  {
                    percent: 1,
                    y: -500,
                    easing: 'quadraticIn',
                    scaleX: 0.1,
                    scaleY: 0.1,
                  },
                ],
              },
              children: result.elements,
            },
          ],
        };
      },
    },
  });
});
