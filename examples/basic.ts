import * as parser from '../src/main';
import * as echarts from 'echarts';

parser.install(echarts);

fetch('./data/echarts_www_chart.json')
  .then((response) => response.json())
  .then((data) => {
    const chart = echarts.init(document.getElementById('main'), null, {
      renderer: 'svg',
    });
    const result = parser.parse(data);
    chart.setOption({
      backgroundColor: '#000',
      graphic: {
        elements: result.elements,
      },
    });
    console.log(result.elements);
  });
