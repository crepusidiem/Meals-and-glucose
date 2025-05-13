import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let dataSets;

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
  const [cMin,cMax]   = calorieSlider.noUiSlider.get().map(Number);
  const [cbMin,cbMax] = carbsSlider.noUiSlider.get().map(Number);
  const [sMin,sMax]   = sugarSlider.noUiSlider.get().map(Number);
  const [pMin,pMax]   = proteinSlider.noUiSlider.get().map(Number);

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

    // aggregate per minute for each dataset
    const aggregated = d3.range(0, 61, 5).map(t => {
      const vals = filteredIdx.map(i => {
        const pt = ds.seriesRaw[i].find(p => p.minute === +t);
        return pt ? pt.value : null;
      }).filter(v => v != null);
      return { minute: +t, value: d3.mean(vals) };
    }).filter(pt => pt.value != null);

    return { name: ds.name, series: aggregated };
  });

  // recompute y-domain based on filtered data
  const allValues = seriesData.flatMap(d => d.series.map(pt => pt.value));
  const [yMin, yMax] = d3.extent(allValues);
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
    const circs = d3.select(this).selectAll('circle').data(d.series);
    circs.enter().append('circle').attr('r', 3)
      .merge(circs)
      .attr('cx', pt => d3.scaleLinear().domain([0, 60]).range([40, +svg.attr('width') - 50])(pt.minute))
      .attr('cy', pt => y(pt.value))
      .attr('fill', colorScale(i));
    circs.exit().remove();
  });

  groups.exit().remove();
}

// initialize the chart and sliders
async function initializeChartAndSliders(dataFiles) {
  const allData = await loadData(dataFiles);
  dataSets = processData(allData);
  
  const svg = d3.select('svg');
  // clear previous content
  svg.selectAll('*').remove(); 

  const W = +svg.attr('width') - 50;
  const H = +svg.attr('height') - 50;

  // render axis
  const x = d3.scaleLinear().domain([0, 60]).range([40, W]);
  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x));

  const y = d3.scaleLinear().range([H, 10]);
  svg.append('g').attr('class', 'y-axis').attr('transform', `translate(40,0)`);

  // create sliders based on extreme values for each nutrition 
  const calorieSlider = createSlider('calorie-slider', 0, calorieMax, 1, 0, calorieMax);
  const carbsSlider = createSlider('carbs-slider', 0, carbMax, 1, 0, carbMax);
  const sugarSlider = createSlider('sugar-slider', 0, sugarMax, 1, 0, sugarMax);
  const proteinSlider = createSlider('protein-slider', 0, proteinMax, 1, 0, proteinMax);

  // initial chart 
  updateChart(dataSets, svg, calorieSlider, carbsSlider, sugarSlider, proteinSlider);

  // add event listener to each of the sliders
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
    { name: '(M, High)', file: 'data/male_high.csv', gender: 'male',   glucose: 'high' },
    { name: '(M, Low)', file: 'data/male_low.csv', gender: 'male',   glucose: 'low'  },
    { name: '(F, High)', file: 'data/female_high.csv', gender: 'female', glucose: 'high' },
    { name: '(F, Low)', file: 'data/female_low.csv', gender: 'female', glucose: 'low'  },
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

  drawChart(filtered);
}

// Attach event listeners for filter changes
genderSelect.on('change', onFilterChange);
glucoseSelect.on('change', onFilterChange);

initializeChartAndSliders(allDataFiles);