import * as parser from '../src/main';
import * as echarts from 'echarts';

parser.install(echarts);

fetch('./data/echarts-www/compatible.json')
  .then((response) => response.json())
  .then((data) => {
    const chart = echarts.init(document.getElementById('main'), null, {
      renderer: 'svg',
    });
    const result = parser.parse(data);

    // function childrenHasName(el, name) {
    //   return !!(
    //     el.name === name ||
    //     (el.children &&
    //       el.children.find((child) => childrenHasName(child, name)))
    //   );
    // }
    chart.setOption({
      backgroundColor: '#000',
      graphic: {
        elements: result.elements,
      },
    });
    console.log(result.elements);
  });
