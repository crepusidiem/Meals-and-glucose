    // Responsive SVG sizing
    const svg = d3.select('svg');
    function resizeSvg() {
      const ctrlH = document.getElementById('controls').offsetHeight;
      const instrH = document.getElementById('instructions').offsetHeight;
      svg
        .attr('width', window.innerWidth * 0.9)
        .attr('height', window.innerHeight - ctrlH - instrH - 40);
    }
    window.addEventListener('resize', resizeSvg);
    resizeSvg();

    // Data files (unchanged)
    const allDataFiles = [
      { name: 'Sample A (M, High)',  file: 'data/male_high.csv' },
      { name: 'Sample B (M, Low)',   file: 'data/male_low.csv' },
      { name: 'Sample C (F, High)',  file: 'data/female_high.csv' },
      { name: 'Sample D (F, Low)',   file: 'data/female_low.csv' }
    ];

    let currentDataFiles = [];

    function drawChart(dataFiles) {
      currentDataFiles = dataFiles;
      svg.selectAll('*').remove();
      initialize(dataFiles);
    }

    function initialize(dataFiles) {
      // Tooltip
      let tooltip = d3.select('body').select('div.tooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('class', 'tooltip');
      }

      // Load CSVs
      Promise.all(dataFiles.map(d =>
        d3.csv(d.file, d3.autoType).then(raw => ({ name: d.name, raw }))
      )).then(allData => {
        // Compute slider maxima
        const values = key => allData.flatMap(ds => ds.raw.map(r => r[key]));
        const maxCal = d3.max(values('calorie'));
        const maxCarb = d3.max(values('total_carb'));
        const maxSugar = d3.max(values('sugar'));
        const maxProt = d3.max(values('protein'));

        // Prepare datasets
        const times = d3.range(0,61,5).map(String);
        const dataSets = allData.map(({ name, raw }) => ({
          name,
          meta: raw,
          seriesRaw: raw.map(d =>
            times.map(t => ({ minute: +t, value: d[t] })).filter(pt => pt.value != null)
          )
        }));

        // Scales & axes
        const width = +svg.attr('width');
        const height = +svg.attr('height');
        const W = width - 60;
        const H = height - 60;
        const x = d3.scaleLinear().domain([0,60]).range([50, W]);
        const y = d3.scaleLinear().range([H, 50]);

        // X axis
        svg.append('g')
           .attr('transform', 'translate(0,' + H + ')')
           .call(d3.axisBottom(x).ticks(6))
           .append('text')
           .attr('x', W/2)
           .attr('y', 40)
           .attr('fill', '#333')
           .attr('font-size', '14px')
           .text('Minutes After Meal');

        // Y axis
        svg.append('g')
           .attr('transform', 'translate(50,0)')
           .call(d3.axisLeft(y).ticks(6))
           .append('text')
           .attr('transform', 'rotate(-90)')
           .attr('x', -H/2)
           .attr('y', -40)
           .attr('fill', '#333')
           .attr('font-size', '14px')
           .text('Δ Glucose Level (mg/dL)');

        // Title
        svg.append('text')
           .attr('x', width/2)
           .attr('y', 30)
           .attr('text-anchor', 'middle')
           .attr('font-size', '18px')
           .attr('font-weight', '600')
           .attr('fill', '#222')
           .text('Effect of Food on Glucose Over Time');

        // Zoom behavior
        const zoom = d3.zoom()
          .scaleExtent([1,8])
          .translateExtent([[0,0],[width,height]])
          .extent([[0,0],[width,height]])
          .on('zoom', event => {
            const nx = event.transform.rescaleX(x);
            const ny = event.transform.rescaleY(y);
            svg.selectAll('g.x-axis').call(d3.axisBottom(nx));
            svg.selectAll('g.y-axis').call(d3.axisLeft(ny));
            svg.selectAll('.data-line')
               .attr('d', d3.line()
                 .x(pt => nx(pt.minute))
                 .y(pt => ny(pt.value))
               );
            svg.selectAll('.data-circle')
               .attr('cx', pt => nx(pt.minute))
               .attr('cy', pt => ny(pt.value));
          });
        svg.call(zoom);

        // Create sliders
        function makeSlider(id, max) {
          const el = document.getElementById(id);
          if (el.noUiSlider) el.noUiSlider.destroy();
          noUiSlider.create(el, {
            start: [0, max],
            connect: true,
            range: { min: 0, max },
            tooltips: true,
            format: { to: v => v.toFixed(0), from: v => +v }
          });
          return el.noUiSlider;
        }
        const sCal = makeSlider('calorie-slider', maxCal);
        const sCarb = makeSlider('carbs-slider', maxCarb);
        const sSugar = makeSlider('sugar-slider', maxSugar);
        const sProt = makeSlider('protein-slider', maxProt);

        // Line generator
        const lineGen = d3.line().curve(d3.curveMonotoneX)
          .x(d => x(d.minute)).y(d => y(d.value));

        // Update chart
        function update() {
          const ranges = [sCal, sCarb, sSugar, sProt].map(s => s.get().map(Number));
          const [c0, c1] = ranges[0], [cb0, cb1] = ranges[1], [s0, s1] = ranges[2], [p0, p1] = ranges[3];

          const filtered = dataSets.map(ds => {
            const idx = ds.meta.map((m,i) => (
              m.calorie >= c0 && m.calorie <= c1 &&
              m.total_carb >= cb0 && m.total_carb <= cb1 &&
              m.sugar >= s0 && m.sugar <= s1 &&
              m.protein >= p0 && m.protein <= p1
            ) ? i : null).filter(i => i !== null);
            const agg = times.map(t => ({
              minute: +t,
              value: d3.mean(idx.map(i => ds.seriesRaw[i].find(pt => pt.minute === +t)?.value).filter(v => v != null))
            })).filter(d => d.value != null);
            return { name: ds.name, series: agg };
          }).filter(d => d.series.length);

          y.domain(d3.extent(filtered.flatMap(d => d.series.map(pt => pt.value)))).nice();
          svg.select('g.y-axis').call(d3.axisLeft(y));

          const color = d3.scaleSequential(d3.interpolateViridis)
            .domain([0, filtered.length - 1 || 1]);

          // DATA JOIN
          const lines = svg.selectAll('.data-line').data(filtered, d => d.name);
          lines.enter().append('path')
            .attr('class', 'data-line')
            .merge(lines)
            .attr('fill', 'none')
            .attr('stroke', (d,i) => color(i))
            .attr('stroke-width', 2)
            .attr('d', d => lineGen(d.series));
          lines.exit().remove();

          const circles = svg.selectAll('.data-circle').data(filtered.flatMap(d => d.series.map(pt => ({ ...pt, name: d.name }))), d => d.name + '-' + d.minute);
          circles.enter().append('circle')
            .attr('class', 'data-circle')
            .attr('r', 3)
            .merge(circles)
            .attr('cx', d => x(d.minute))
            .attr('cy', d => y(d.value))
            .attr('fill', d => color(filtered.findIndex(s => s.name === d.name)))
            .on('mouseover', (e,d) => tooltip.style('opacity', 1).html(d.name + '<br>Min: ' + d.minute + '<br>Val: ' + d.value))
            .on('mousemove', e => tooltip.style('left', (e.pageX+10) + 'px').style('top', (e.pageY-10) + 'px'))
            .on('mouseout', () => tooltip.style('opacity', 0));
          circles.exit().remove();

          // Legend
          svg.selectAll('g.legend').remove();
          const legend = svg.append('g').attr('class', 'legend').attr('transform', `translate(${W-100},60)`);
          filtered.forEach((d,i) => {
            const item = legend.append('g').attr('class', 'legend-item').attr('transform', `translate(0,${i*25})`)
              .on('click', () => {
                const visible = svg.selectAll('.data-line').filter(l => l.name === d.name).style('display') !== 'none';
                svg.selectAll('.data-line').filter(l => l.name === d.name).style('display', visible ? 'none' : null);
                svg.selectAll('.data-circle').filter(c => c.name === d.name).style('display', visible ? 'none' : null);
              });
            item.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(i));
            item.append('text').attr('x', 18).attr('y', 12).attr('fill', '#333').text(d.name).attr('font-size', '13px');
          });
        }

        [sCal, sCarb, sSugar, sProt].forEach(s => s.on('update', update));
        d3.select('#reset-button').on('click', () => {
          sCal.set([0, maxCal]); sCarb.set([0, maxCarb]); sSugar.set([0, maxSugar]); sProt.set([0, maxProt]);
          drawChart(allDataFiles);
        });

        update();
      });
    }

    drawChart(allDataFiles);