import * as lottieParser from '../src/main';
import * as echarts from 'echarts';
import { Pane } from 'tweakpane';

lottieParser.install(echarts);

function childrenHasName(el, name) {
  return !!(
    el.name === name ||
    (el.children && el.children.find((child) => childrenHasName(child, name)))
  );
}
function setAnimationToLoop(elements) {
  elements.forEach((el) => {
    el.keyframeAnimation?.forEach((anim) => {
      anim.loop = true;
    });

    if (el.children) {
      setAnimationToLoop(el.children);
    }
  });
}

const chart = echarts.init(document.getElementById('main'), null, {
  renderer: 'svg',
});

const config = {
  file: 'adrock.json',
};
function displayLottie() {
  fetch(`./data/${config.file}`)
    .then((response) => response.json())
    .then((data) => {
      const result = lottieParser.parse(data);

      setAnimationToLoop(result.elements);

      chart.setOption(
        {
          // backgroundColor: 'black',
          graphic: {
            elements: result.elements,
          },
        },
        true
      );

      console.log(result.elements);
    });
}

displayLottie();

const pane = new Pane();
pane
  // @ts-ignore
  .addInput(config, 'file', {
    options: {
      'adrock.json': 'adrock.json',
      'failed-location-verification.json': 'failed-location-verification.json',
      'gatin.json': 'gatin.json',
      'kadokado-heart.json': 'kadokado-heart.json',
      'liquid-blobby-loader-green.json': 'liquid-blobby-loader-green.json',
      'pin-location.json': 'pin-location.json',
      'rocket.json': 'rocket.json',
      'echarts-www/bg.json': 'echarts-www/bg.json',
      'echarts-www/analysis.json': 'echarts-www/analysis.json',
      'echarts-www/chart.json': 'echarts-www/chart.json',
      'echarts-www/compatible.json': 'echarts-www/compatible.json',
      'echarts-www/end_line.json': 'echarts-www/end_line.json',
      'echarts-www/fly.json': 'echarts-www/fly.json',
      'echarts-www/grown.json': 'echarts-www/grown.json',
      'echarts-www/paper.json': 'echarts-www/paper.json',
      'echarts-www/simple.json': 'echarts-www/simple.json',
      'echarts-www/start_line.json': 'echarts-www/start_line.json',
    },
  })
  .on('change', () => {
    displayLottie();
  });
