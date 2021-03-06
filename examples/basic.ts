import * as lottieParser from '../src/main';
import * as echarts from 'echarts';
import lottie from 'lottie-web';
import { Pane } from 'tweakpane';

lottieParser.install(echarts);

function childrenHasName(el, name) {
  return !!(
    el.name === name ||
    (el.children && el.children.find((child) => childrenHasName(child, name)))
  );
}

const config = {
  file: 'rocket.json',
  renderer: 'svg' as 'svg' | 'canvas',
};
let chart = echarts.init(document.getElementById('chart'), null, {
  renderer: config.renderer,
});

function displayLottie() {
  fetch(`./data/${config.file}`)
    .then((response) => response.json())
    .then((data) => {
      lottie.destroy();
      // Reference
      lottie.loadAnimation({
        container: document.querySelector('#reference'), // the dom element that will contain the animation
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: JSON.parse(JSON.stringify(data)),
      });

      const result = lottieParser.parse(data, {
        loop: true,
      });

      const scale = Math.min(400 / result.width, 400 / result.height);

      chart.setOption(
        {
          // backgroundColor: 'black',
          graphic: {
            elements: [
              {
                type: 'group',
                scaleX: scale,
                scaleY: scale,
                children: result.elements,
              },
            ],
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
    options: [
      'adrock.json',
      'gatin.json',
      'bodymovin.json',
      'failed-location-verification.json',
      'kadokado-heart.json',
      'liquid-blobby-loader-green.json',
      'pin-location.json',
      'rocket.json',
      'rocket-lunch.json',
      'walking.json',
      'cat-loader.json',
      'multiple-spinning-dotted-rings-loading.json',
      'spooky-ghost.json',
      'preloader.json',
      'check-mark-success.json',
      'gradient-animated-background.json',
      'splashy-loader.json',
      'loading.json',
      'location.json',
      'sci-fi-background.json',
      'bouncy-mapmaker.json',
      'echarts-www/bg.json',
      'echarts-www/analysis.json',
      'echarts-www/chart.json',
      'echarts-www/compatible.json',
      'echarts-www/end_line.json',
      'echarts-www/fly.json',
      'echarts-www/grown.json',
      'echarts-www/paper.json',
      'echarts-www/simple.json',
      'echarts-www/start_line.json',
    ].reduce((obj, val) => {
      obj[val] = val;
      return obj;
    }, {}),
  })
  .on('change', () => {
    displayLottie();
  });

pane
  // @ts-ignore
  .addInput(config, 'renderer', {
    options: {
      svg: 'svg',
      canvas: 'canvas',
    },
  })
  .on('change', () => {
    chart.dispose();
    chart = echarts.init(document.getElementById('chart'), null, {
      renderer: config.renderer,
    });
    displayLottie();
  });
