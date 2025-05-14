import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let dataSets;
let yMin, yMax;
let path_show = [1, 1, 1, 1];


let sugarMax = 150;
let carbMax = 460;
let proteinMax = 130;
let calorieMax = 3480;



// load all csv data files
async function loadData(dataFiles) {

  const allFiles = await Promise.all(
    dataFiles.map(d =>
      d3.csv(d.file, d3.autoType).then(raw => ({ name: d.name, raw }))
    )
  );
  return allFiles;
}

// process data to extract necessary information
function processData(allData) {
  const times = d3.range(0, 61, 5).map(String);
  return allData.map(({ name, raw }) => ({
    name,
    meta: raw.map(d => ({
      calorie: d.calorie,
      total_carb: d.total_carb,
      sugar: d.sugar,
      protein: d.protein
    })),
    seriesRaw: raw.map(d =>
      times
        .map(t => ({ minute: +t, value: d[t] }))
        .filter(pt => pt.value != null)
    )
  }));
}

// create a slider with min, max range 
function createSlider(id, min, max, step, defaultMin, defaultMax) {
  const slider = document.getElementById(id);
  // clear previous slider
  if (slider.noUiSlider) {  
    slider.noUiSlider.destroy();
  }
  noUiSlider.create(slider, {
    start: [defaultMin, defaultMax],
    connect: true,
    range: { min, max },
    step,
    tooltips: [true, true],
  });
  return slider;
}

// update the chart based on slider values
function updateChart(dataSets, svg, calorieSlider, carbsSlider, sugarSlider, proteinSlider) {
  // get the current values selected by the user
  let [cMin,cMax] = calorieSlider.noUiSlider.get().map(Number);
  let [cbMin,cbMax] = carbsSlider.noUiSlider.get().map(Number);
  let [sMin,sMax] = sugarSlider.noUiSlider.get().map(Number);
  let [pMin,pMax] = proteinSlider.noUiSlider.get().map(Number);

  // prepare filtered data based on selected slider values
  const seriesData = dataSets.map(ds => {
    // filter rows within the selected range
    // return index of the rows
    const filteredIdx = ds.meta.map(
        (m,i) => (m.calorie >= cMin && 
                m.calorie <= cMax && 
                m.total_carb >= cbMin && 
                m.total_carb <= cbMax && 
                m.sugar >= sMin && 
                m.sugar <= sMax && 
                m.protein >= pMin && 
                m.protein <= pMax) ? i : null)
      .filter(i => i !== null);

    // aggregate glucose value per minute for each dataset
    const aggregated = d3.range(0, 61, 5).map(t => {
      const vals = filteredIdx.map(i => {
        const pt = ds.seriesRaw[i].find(p => p.minute === +t);
        return pt ? pt.value : null;
      }).filter(v => v != null);
      return { minute: +t, value: d3.mean(vals) };
    }).filter(pt => pt.value != null);

    return { name: ds.name, series: aggregated.map(pt => ({ ...pt, name: ds.name })) };
  });

  // recompute y-domain based on filtered data
  const allValues = seriesData.flatMap(d => d.series.map(pt => pt.value));
  [yMin, yMax] = d3.extent(allValues);
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([+svg.attr('height') - 50, 10]);

  // update y-axis 
  svg.select('.y-axis').call(d3.axisLeft(y));

  // find elements that are binded to data-group
  const groups = svg.selectAll('.data-group').data(seriesData, d => d.name);
  // create new <g class = "data-group"> for data points in seriesData
  const enterG = groups.enter().append('g').attr('class', 'data-group');
  const colorScale = d3.scaleOrdinal(d3.schemePaired);

  // draw paths and circles for each dataset
  enterG.merge(groups).each(function(d, i) {
    const lineGen = d3.line()
      .x(d => d3.scaleLinear().domain([0, 60]).range([40, +svg.attr('width') - 50])(d.minute))
      .y(d => y(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // paths
    const path = d3.select(this).selectAll('path').data([d.series]);
    path.enter().append('path')
      .merge(path)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', colorScale(i))
      .attr('stroke-width', 2);
    path.exit().remove();

    // circles
    const circles = d3.select(this).selectAll('circle').data(d.series);

    let tooltip = d3.select('body').select('div.tooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('class', 'tooltip');
    }

    circles.enter()
      .append('circle')
      .merge(circles)
      .attr('r', 3)
      .attr('cx', pt => d3.scaleLinear().domain([0, 60]).range([40, +svg.attr('width') - 50])(pt.minute))
      .attr('cy', pt => y(pt.value))
      .attr('fill', colorScale(i))
      .on('mouseover', (e,d) => tooltip.style('opacity', 1).html(d.name + '<br>Min: ' + d.minute + '<br>Val: ' + d.value))
      .on('mousemove', e => tooltip.style('left', (e.pageX+10) + 'px').style('top', (e.pageY-10) + 'px'))
      .on('mouseout', () => tooltip.style('opacity', 0));
      // .on('mouseover', (event, pt) => {
      //   renderTooltipContent(pt);
      //   updateTooltipVisibility(true);
      //   updateTooltipPosition(event);
      //   console.log('mouseenter');
      // })
      // .on('mouseleave', (event) => {
      //             // TODO: Hide the tooltip
      //             //d3.select(event.currentTarget).style('fill-opacity', 0.7);
      //             //updateTooltipVisibility(false);
      //             console.log('mouseleave');
      // });
    circles.exit().remove();
  });

  groups.exit().remove();

  // create or select legend container
  let legend = svg.select('.legend');
  if (legend.empty()) {
    legend = svg
          .append('g')
          .attr('class', 'legend')
          .attr('transform', 'translate(50, 10)');
  }

  const legendItems = legend.selectAll('.legend-item').data(seriesData, d => d.name);

  // update the visibility of the line 
  const legendEnter = legendItems.enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`)
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      // Toggle visibility of group
      const group = svg.selectAll('.data-group')
        .filter(g => g.name === d.name);

      const isHidden = group.classed('hidden');
      group.classed('hidden', !isHidden);

      // Dim legend item if hidden
      d3.select(this).select('text')
        .style('opacity', isHidden ? 1 : 0);
    });

  legendEnter.append('rect')
    .attr('width', 10)
    .attr('height', 10)
    .attr('fill', (d, i) => colorScale(i));

  legendEnter.append('text')
    .attr('x', 15)
    .attr('y', 8)
    .text(d => d.name)
    .style('font-size', '12px')
    .style('alignment-baseline', 'middle');

  legendItems.exit().remove();
}

function renderTooltipContent(commit) {
  const time = document.getElementById('commit-time');
  const glucose = document.getElementById('commit-glucose');

  if (Object.keys(commit).length === 0) return;

  time.textContent = commit.minute;
  glucose.textContent = commit.value;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

// initialize the chart and sliders
async function initializeChartAndSliders(dataFiles) {
  const allData = await loadData(dataFiles);
  dataSets = processData(allData);
  //const svg = d3.select('svg');
  // const width = 1000;
  // const height = 600;
  const svg = d3.select('#line-plot');
  // clear previous content
  svg.selectAll('*').remove(); 

  const W = +svg.attr('width') - 50;
  const H = +svg.attr('height') - 50;

  // render axis and add label
  const x = d3.scaleLinear().domain([0, 60]).range([40, W]);
  svg.append('g')
    .attr('transform', 'translate(0,' + H + ')')
    .call(d3.axisBottom(x).ticks(6))
    .append('text')
    .attr('x', W/2)
    .attr('y', 40)
    .attr('fill', '#333')
    .attr('font-size', '14px')
    .text('Minutes After Meal');



  const y = d3.scaleLinear().domain([yMin, yMax]).range([H, 10]);
  svg.append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(40,0)`)
    .call(d3.axisLeft(y))
    .append('text')
    .attr('transform', `rotate(-90)`)
    .attr('x', -H/2+50)
    .attr('y', -40)
    .attr('fill', '#333')
    .attr('font-size', '14px')
    .text('Glucose Value (mg/dL)');

  // create sliders based on extreme values for each nutrition 
  const calorieSlider = createSlider('calorie-slider', 0, calorieMax, 1, 0, calorieMax);
  const carbsSlider = createSlider('carbs-slider', 0, carbMax, 1, 0, carbMax);
  const sugarSlider = createSlider('sugar-slider', 0, sugarMax, 1, 0, sugarMax);
  const proteinSlider = createSlider('protein-slider', 0, proteinMax, 1, 0, proteinMax);

  // initial chart 
  updateChart(dataSets, svg, calorieSlider, carbsSlider, sugarSlider, proteinSlider);

  // add event listener to each of the sliders when selecting ranges on the sliders
  [calorieSlider, carbsSlider, sugarSlider, proteinSlider].forEach(s => s.noUiSlider.on('update', () => updateChart(dataSets, svg, calorieSlider, carbsSlider, sugarSlider, proteinSlider)));

  // reset all events:
  d3.select('#reset-button').on('click', () => {
    calorieSlider.noUiSlider.set([0, calorieMax]);
    carbsSlider.noUiSlider.set([0, carbMax]);
    sugarSlider.noUiSlider.set([0, sugarMax]);
    proteinSlider.noUiSlider.set([0, proteinMax]);

    genderSelect.property('value', 'both-mf');
    glucoseSelect.property('value', 'both-hl');

    drawChart(allDataFiles);
  });
}

// draw the chart with selected data files
function drawChart(dataFiles) {
  initializeChartAndSliders(dataFiles);
}

// create options for gender and glucose
document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label id="gender-scheme">
    Gender:
    <select id="set-gender">
      <option value="both-mf">Both</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
    </select>
    </label>`,
)

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label id="glucose-scheme">
    Glucose:
    <select id="set-glucose">
      <option value="both-hl">Both</option>
      <option value="high">High</option>
      <option value="low">Low</option>
    </select>
    </label>`,
)
  
const allDataFiles = [
    { name: '(Male, High glucose level)', file: 'data/male_high.csv', gender: 'male', glucose: 'high' },
    { name: '(Male, Low glucose level)', file: 'data/male_low.csv', gender: 'male', glucose: 'low'  },
    { name: '(Female, High glucose level)', file: 'data/female_high.csv', gender: 'female', glucose: 'high' },
    { name: '(Female, Low glucose level)', file: 'data/female_low.csv', gender: 'female', glucose: 'low'  },
];
  

// set up filters for gender and glucose level
const genderSelect = d3.select('#set-gender');
const glucoseSelect = d3.select('#set-glucose');

function onFilterChange() {
  const gender = genderSelect.node().value;   // "male", "female", or "both-mf"
  const glucose = glucoseSelect.node().value;  // "high", "low", or "both-hl"

  const filtered = allDataFiles.filter(d => {
    const genderOK = gender === 'both-mf' ? true : d.gender === gender;
    const glucoseOK = glucose === 'both-hl' ? true : d.glucose === glucose;
    return genderOK && glucoseOK;
  });

  let calorieSlider = document.getElementById("calorie-slider");
  let carbsSlider = document.getElementById("carbs-slider");
  let sugarSlider = document.getElementById("sugar-slider");
  let proteinSlider = document.getElementById("protein-slider");

  // save the slider values
  const currentValues = {
    calorie: calorieSlider.noUiSlider.get(),
    carbs: carbsSlider.noUiSlider.get(),
    sugar: sugarSlider.noUiSlider.get(),
    protein: proteinSlider.noUiSlider.get()
  };

  drawChart(filtered);

  //set the value after 50 ms.
  setTimeout(() => {
    calorieSlider.noUiSlider.set(currentValues.calorie);
    carbsSlider.noUiSlider.set(currentValues.carbs);
    sugarSlider.noUiSlider.set(currentValues.sugar);
    proteinSlider.noUiSlider.set(currentValues.protein);
  }, 50);
}

// Attach event listeners for filter changes
genderSelect.on('change', onFilterChange);
glucoseSelect.on('change', onFilterChange);

initializeChartAndSliders(allDataFiles);