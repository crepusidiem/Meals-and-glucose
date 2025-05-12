// script.js

// Utility to create a dual-handle slider
function createSlider(id, min, max, step, defaultMin, defaultMax) {
  const slider = document.getElementById(id);
  noUiSlider.create(slider, {
    start: [defaultMin, defaultMax],
    connect: true,
    range: { min, max },
    step,
    tooltips: [true, true],
    format: {
      to: value => parseFloat(value).toFixed(1),
      from: value => parseFloat(value)
    }
  });
  return slider;
}

d3.csv("female_high.csv", d3.autoType).then(data => {
  const svg = d3.select("svg");
  const width = +svg.attr("width") - 50;
  const height = +svg.attr("height") - 50;

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.minutes_from_basis))
    .range([40, width]);
  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.current_glucose))
    .range([height, 10]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svg.append("g")
    .attr("transform", `translate(40,0)`)
    .call(d3.axisLeft(y));

  const updateChart = () => {
    const [calMin, calMax]   = calorieSlider.noUiSlider.get().map(Number);
    const [carbMin, carbMax] = carbsSlider.noUiSlider.get().map(Number);
    const [sugarMin, sugarMax] = sugarSlider.noUiSlider.get().map(Number);
    const [protMin, protMax] = proteinSlider.noUiSlider.get().map(Number);

    document.getElementById("calorie-val").textContent = `${calMin} - ${calMax}`;
    document.getElementById("carbs-val").textContent   = `${carbMin} - ${carbMax}`;
    document.getElementById("sugar-val").textContent   = `${sugarMin} - ${sugarMax}`;
    document.getElementById("protein-val").textContent = `${protMin} - ${protMax}`;

    const filtered = data.filter(d =>
      d.calorie    >= calMin   && d.calorie    <= calMax &&
      d.total_carb >= carbMin  && d.total_carb <= carbMax &&
      d.sugar      >= sugarMin && d.sugar      <= sugarMax &&
      d.protein    >= protMin  && d.protein    <= protMax
    );

    const circles = svg.selectAll("circle")
      .data(filtered, d => d.current_time);

    circles.enter().append("circle")
      .attr("r", 3)
      .style("fill", "steelblue")
      .merge(circles)
      .attr("cx", d => x(d.minutes_from_basis))
      .attr("cy", d => y(d.current_glucose));

    circles.exit().remove();
  };

  // 1. Create sliders
  const calorieSlider = createSlider("calorie-slider",  0, 200, 1,   0, 200);
  const carbsSlider   = createSlider("carbs-slider",    0, 100, 1,   0, 100);
  const sugarSlider   = createSlider("sugar-slider",    0, 100, 1,   0, 100);
  const proteinSlider = createSlider("protein-slider",  0, 50,  0.5, 0, 50);

  // 2. Wire up update callbacks
  [calorieSlider, carbsSlider, sugarSlider, proteinSlider]
    .forEach(slider => slider.noUiSlider.on('update', updateChart));

  // Initial draw
  updateChart();

  const resetButton = document.getElementById("reset-button");
  resetButton.addEventListener("click", () => {
    // reset all four sliders back to their defaults
    calorieSlider.noUiSlider.set([0, 200]);
    carbsSlider.noUiSlider.set([0, 100]);
    sugarSlider.noUiSlider.set([0, 100]);
    proteinSlider.noUiSlider.set([0, 50]);
});

// Add this after the sliders are created

})