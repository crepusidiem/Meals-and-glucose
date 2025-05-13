import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// create a slider with min, max range 
function createSlider(id, min, max, step, defaultMin, defaultMax) {
  const slider = document.getElementById(id);
  noUiSlider.create(slider, {
    start: [defaultMin, defaultMax],
    connect: true,
    range: { min, max },
    step,
    tooltips: [true, true],
    
  });

  return slider;
}

// set the color scheme for the lines (edited later)
const colorSchemes = {
  Viridis: d3.interpolateViridis,
  Plasma:  d3.interpolatePlasma,
  Inferno: d3.interpolateInferno,
  Magma:   d3.interpolateMagma
};

// Initialize chart with multiple CSV files
function initializeChartAndSliders(dataFiles) {
  // Load all datasets
  const promises = dataFiles.map(d =>
    d3.csv(d.file, d3.autoType).then(raw => ({ name: d.name, raw }))
  );

  Promise.all(promises).then(allData => {
    // Common setup
    const times = d3.range(0, 61, 5).map(String);
    const dataSets = allData.map(({ name, raw }) => ({
      name,
      meta: raw.map(d => ({ calorie: d.calorie, total_carb: d.total_carb, sugar: d.sugar, protein: d.protein })),
      seriesRaw: raw.map(d => times.map(t => ({ minute: +t, value: d[t] })).filter(pt => pt.value != null))
    }));

    const svg = d3.select('svg');
    const W = +svg.attr('width') - 50;
    const H = +svg.attr('height') - 50;

    const x = d3.scaleLinear().domain([0, 60]).range([40, W]);
    let y = d3.scaleLinear().range([H, 10]);

    // Axes groups
    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(x));

    svg.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(40,0)`);

    // Controls
    const calorieSlider = createSlider('calorie-slider', 0, 2000, 1, 0, 2000);
    const carbsSlider   = createSlider('carbs-slider',   0, 200,  1, 0, 200);
    const sugarSlider   = createSlider('sugar-slider',   0, 200,  1, 0, 200);
    const proteinSlider = createSlider('protein-slider', 0, 200,  1, 0, 200);
    const colorSelect   = d3.select('#color-select');

    // Smoothing line generator
    const lineGen = d3.line()
      .x(d => x(d.minute))
      .y(d => y(d.value))
      .curve(d3.curveBasis);

    function updateChart() {
      // Get filter extents
      const [cMin,cMax]   = calorieSlider.noUiSlider.get().map(Number);
      const [cbMin,cbMax] = carbsSlider.noUiSlider.get().map(Number);
      const [sMin,sMax]   = sugarSlider.noUiSlider.get().map(Number);
      const [pMin,pMax]   = proteinSlider.noUiSlider.get().map(Number);

      // Prepare series data per dataset
      const seriesData = dataSets.map(ds => {
        // Filter rows
        const filteredIdx = ds.meta
          .map((m,i) => (m.calorie>=cMin && m.calorie<=cMax && m.total_carb>=cbMin && m.total_carb<=cbMax && m.sugar>=sMin && m.sugar<=sMax && m.protein>=pMin && m.protein<=pMax) ? i : null)
          .filter(i => i !== null);

        // Aggregate per minute
        const aggregated = times.map(t => {
          const vals = filteredIdx.map(i => {
            const pt = ds.seriesRaw[i].find(p => p.minute === +t);
            return pt ? pt.value : null;
          }).filter(v => v != null);
          return { minute: +t, value: d3.mean(vals) };
        }).filter(pt => pt.value != null);

        return { name: ds.name, series: aggregated };
      });

      // Recompute y-domain based on filtered data extremes
      const allValues = seriesData.flatMap(d => d.series.map(pt => pt.value));
      const [yMin, yMax] = d3.extent(allValues);
      y.domain([yMin, yMax]).nice();

      // Update Y axis
      svg.select('.y-axis').call(d3.axisLeft(y));

      // Color palette for datasets
      const schemeFn = colorSchemes[colorSelect.node().value];
      const colorScale = d3.scaleSequential(schemeFn).domain([0, seriesData.length - 1 || 1]);

      // DATA JOIN for groups
      const groups = svg.selectAll('.data-group')
        .data(seriesData, d => d.name);
      const enterG = groups.enter().append('g').attr('class', 'data-group');

      // Draw/update each dataset
      enterG.merge(groups).each(function(d,i) {
        // Path
        const path = d3.select(this).selectAll('path').data([d.series]);
        path.enter().append('path')
          .merge(path)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', colorScale(i))
          .attr('stroke-width', 2);
        path.exit().remove();

        // Circles
        const circs = d3.select(this).selectAll('circle').data(d.series);
        circs.enter().append('circle').attr('r',3)
          .merge(circs)
          .attr('cx', pt => x(pt.minute))
          .attr('cy', pt => y(pt.value))
          .attr('fill', colorScale(i));
        circs.exit().remove();
      });

      groups.exit().remove();
    }

    // Event bindings
    [calorieSlider, carbsSlider, sugarSlider, proteinSlider].forEach(s => s.noUiSlider.on('update', updateChart));
    colorSelect.on('change', updateChart);
    d3.select('#reset-button').on('click', () => {
      calorieSlider.noUiSlider.set([0,2000]);
      carbsSlider.noUiSlider.set([0,200]);
      sugarSlider.noUiSlider.set([0,200]);
      proteinSlider.noUiSlider.set([0,200]);
      colorSelect.property('value','Viridis');
      updateChart();
    });

    // Initial draw
    updateChart();
  });
}



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

let gender='both-mf';
let glucose='both-hl';
let genderselect = document.querySelector('select#set-gender');
let glucoseselect = document.querySelector('select#set-glucose');

genderselect.addEventListener('input', function(event) {
  // Handle
  gender = event.target.value;
  if (gender == 'both-mf') {
    if (glucose == 'both-hl') {
      initializeChartAndSliders([
        { name: 'Female High', file: 'data/female_high.csv' },
        { name: 'Female Low',  file: 'data/female_low.csv' },
        { name: 'Male High',   file: 'data/male_high.csv' },
        { name: 'Male Low',   file: 'data/male_low.csv' }
      ]);
    } else if (glucose == 'high') {
      initializeChartAndSliders([
        { name: 'Female High', file: 'data/female_high.csv' },
        { name: 'Male High',   file: 'data/male_high.csv' },
    ]);
  }
  }
});
glucoseselect.addEventListener('input', function(event) {
  // Handle
  glucose = event.target.value;
});
// Pass an array of datasets with name and file path
initializeChartAndSliders([
  { name: 'Female High', file: 'data/female_high.csv' },
  { name: 'Female Low',  file: 'data/female_low.csv' },
  { name: 'Male High',   file: 'data/male_high.csv' },
  { name: 'Male Low',   file: 'data/male_low.csv' }
]);