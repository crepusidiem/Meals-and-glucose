// Responsive SVG sizing
const svg = d3.select('svg');
const margin = { top: 50, right: 190, bottom: 50, left: 50 };
function resizeSvg() {
  const ctrlH = document.getElementById('controls').offsetHeight;
  const instrH = document.getElementById('instructions').offsetHeight;
  svg
    .attr('width', window.innerWidth * 0.9)
    .attr('height', window.innerHeight - ctrlH - instrH - 40);
}
window.addEventListener('resize', resizeSvg);
resizeSvg();

// Data files
const allDataFiles = [
  { name: 'Male & High Glucose',  file: 'data/male_high.csv' },
  { name: 'Male & Low Glucose',   file: 'data/male_low.csv'  },
  { name: 'Female & High Glucose',  file: 'data/female_high.csv'},
  { name: 'Female & Low Glucose',   file: 'data/female_low.csv' }
];

function drawChart(files) {
  Promise.all(files.map(f =>
    d3.csv(f.file).then(raw => {
      const seriesRaw = raw.map(d =>
        Object.entries(d)
          .filter(([k]) => !isNaN(+k))
          .map(([minute, value]) => ({ minute: +minute, value: +value }))
      );
      return { meta: raw, seriesRaw, name: f.name };
    })
  ))
  .then(dataSets => {
    // Dimensions
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    const W = width - margin.left - margin.right;
    const H = height - margin.top - margin.bottom;

    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear().domain([0,60]).range([0, W]);
    const y = d3.scaleLinear().range([H, 0]);
    y.domain(d3.extent(dataSets.flatMap(ds => ds.seriesRaw.map(pt => pt.value)))).nice();

    // Axes
    const xAxisG = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(x));
    const yAxisG = g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y));

    // Title
    svg.append('text')
      .attr('x', width/2)
      .attr('y', margin.top/2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '18px')
      .attr('font-weight', '600')
      .attr('fill', '#222')
      .text('Effect of Food on Glucose Over Time');

    // Clip path
    svg.append('defs').append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', W)
      .attr('height', H);

    const chartBody = g.append('g').attr('clip-path', 'url(#clip)');

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([1,8])
      .translateExtent([[0,0],[width,height]])
      .extent([[0,0],[width,height]])
      .on('zoom', event => {
        const t = event.transform;
        const nx = t.rescaleX(x);
        const ny = t.rescaleY(y);
        xAxisG.call(d3.axisBottom(nx));
        yAxisG.call(d3.axisLeft(ny));
        chartBody.selectAll('.data-line')
          .attr('d', d => d3.line()
            .x(pt => nx(pt.minute))
            .y(pt => ny(pt.value))(d.series)
          );
        chartBody.selectAll('.data-circle')
          .attr('cx', d => nx(d.minute))
          .attr('cy', d => ny(d.value));
      });
    svg.call(zoom);

    // Sliders
    function makeSlider(id, max) {
      const el = document.getElementById(id);
      noUiSlider.create(el, {
        start: [0, max],
        connect: true,
        range: { min: 0, max },
        tooltips: true,
        format: { to: v => v.toFixed(0), from: v => +v }
      });
      return el.noUiSlider;
    }
    const maxCal = d3.max(dataSets.flatMap(ds => ds.meta.map(m => +m.calorie)));
    const maxCarb = d3.max(dataSets.flatMap(ds => ds.meta.map(m => +m.total_carb)));
    const maxSugar = d3.max(dataSets.flatMap(ds => ds.meta.map(m => +m.sugar)));
    const maxProt = d3.max(dataSets.flatMap(ds => ds.meta.map(m => +m.protein)));
    const sCal = makeSlider('calorie-slider', maxCal);
    const sCarb = makeSlider('carbs-slider', maxCarb);
    const sSugar = makeSlider('sugar-slider', maxSugar);
    const sProt = makeSlider('protein-slider', maxProt);

    // Reset button
    document.getElementById('reset-button').addEventListener('click', () => {
      sCal.set([0, maxCal]);
      sCarb.set([0, maxCarb]);
      sSugar.set([0, maxSugar]);
      sProt.set([0, maxProt]);
      // reset zoom
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      // rebuild chart to restore all lines and legend opacities
      update();
    });

    // Update
    function update() {
      // ensure any hidden lines/circles are shown
      chartBody.selectAll('.data-line').style('display', null);
      chartBody.selectAll('.data-circle').style('display', null);

      const [c0, c1] = sCal.get().map(Number);
      const [cb0, cb1] = sCarb.get().map(Number);
      const [s0, s1] = sSugar.get().map(Number);
      const [p0, p1] = sProt.get().map(Number);
      const filtered = dataSets.map(ds => {
        const idx = ds.meta
          .map((m,i) => (m.calorie>=c0 && m.calorie<=c1 && m.total_carb>=cb0 && m.total_carb<=cb1 &&
                          m.sugar>=s0 && m.sugar<=s1 && m.protein>=p0 && m.protein<=p1) ? i : null)
          .filter(i => i !== null);
        const series = d3.range(0,61).map(minute => ({
          minute,
          value: d3.mean(idx.map(i => ds.seriesRaw[i].find(pt=>pt.minute===minute)?.value))
        })).filter(d=>d.value!=null);
        return { name: ds.name, series };
      }).filter(d => d.series.length > 0);

      // Reset zoom on filter
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      y.domain(d3.extent(filtered.flatMap(d=>d.series.map(pt=>pt.value)))).nice();
      yAxisG.call(d3.axisLeft(y));

      const color = d3.scaleSequential(d3.interpolateViridis).domain([0, Math.max(filtered.length-1,1)]);
      // Lines
      const lines = chartBody.selectAll('.data-line').data(filtered, d=>d.name);
      lines.enter().append('path').attr('class','data-line')
        .merge(lines)
        .attr('fill','none')
        .attr('stroke',(d,i)=>color(i))
        .attr('stroke-width',2)
        .attr('d', d => d3.line().x(pt => x(pt.minute)).y(pt => y(pt.value))(d.series));
      lines.exit().remove();
      // Circles
      const circles = chartBody.selectAll('.data-circle')
        .data(filtered.flatMap(d=>d.series.map(pt=>({ ...pt, name:d.name }))), d=>d.name+'-'+d.minute);
      circles.enter().append('circle').attr('class','data-circle').attr('r',3)
        .merge(circles)
        .attr('fill', d=>color(filtered.findIndex(ds=>ds.name===d.name)))
        .attr('cx', d=>x(d.minute))
        .attr('cy', d=>y(d.value));
      circles.exit().remove();
      // Legend
      svg.selectAll('g.legend').remove();
      const legend = svg.append('g').attr('class','legend').attr('transform',`translate(${width-margin.right+10},${margin.top})`);
      filtered.forEach((d,i) => {
        const item = legend.append('g').attr('class','legend-item').attr('transform',`translate(0,${i*25})`);
        const rect = item.append('rect')
          .attr('width',12)
          .attr('height',12)
          .attr('fill',color(i));
        item.append('text').attr('x',18).attr('y',10).text(d.name).attr('font-size','12px');
        item.on('click', ()=>{
          const selLine = chartBody.selectAll('.data-line').filter(l=>l.name===d.name);
          const selCirc = chartBody.selectAll('.data-circle').filter(c=>c.name===d.name);
          const visible = selLine.style('display') !== 'none';
          selLine.style('display', visible?'none':null);
          selCirc.style('display', visible?'none':null);
          // adjust legend opacity
          rect.style('opacity', visible?0.3:1);
          item.select('text').style('opacity', visible?0.3:1);
        });
      });
    }

    [sCal, sCarb, sSugar, sProt].forEach(s => s.on('update', update));
    update();
  });
}

drawChart(allDataFiles);
