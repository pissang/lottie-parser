import * as lottieParser from '../src/main';
import * as echarts from 'echarts';

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

fetch('./data/kadokado-heart.json')
  .then((response) => response.json())
  .then((data) => {
    const chart = echarts.init(document.getElementById('main'), null, {
      renderer: 'svg',
    });
    const result = lottieParser.parse(data);

    setAnimationToLoop(result.elements);

    chart.setOption({
      // backgroundColor: 'black',
      graphic: {
        elements: result.elements,
      },
    });

    console.log(result.elements);
  });
