const svg = d3.select('svg');
    function resizeSvg() {
      const ctrl = document.getElementById('controls').offsetHeight;
      const instr = document.getElementById('instructions').offsetHeight;
      svg.attr('width', window.innerWidth)
         .attr('height', window.innerHeight - ctrl - instr);
    }
    window.addEventListener('resize', resizeSvg);
    resizeSvg();

    // Data files
    const allDataFiles = [
      { name: 'Sample A (M, High)',  file: 'data/male_high.csv',   gender: 'male',   glucose: 'high' },
      { name: 'Sample B (M, Low)',   file: 'data/male_low.csv',    gender: 'male',   glucose: 'low'  },
      { name: 'Sample C (F, High)',  file: 'data/female_high.csv', gender: 'female', glucose: 'high' },
      { name: 'Sample D (F, Low)',   file: 'data/female_low.csv',  gender: 'female', glucose: 'low'  }
    ];

    let currentDataFiles = [];

    // Main draw function
    function drawChart(dataFiles) {
      currentDataFiles = dataFiles;
      svg.selectAll('*').remove();
      initialize(dataFiles);
    }

    // Initialize controls and chart
    function initialize(dataFiles) {
      // Tooltip
      let tooltip = d3.select('body').select('div.tooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('class', 'tooltip');
      }

      // Filters
      const filtersHtml = `
        <label style="margin-right:1rem;">
          Gender:
          <select id="set-gender">
            <option value="both-mf">Both</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>
          Glucose:
          <select id="set-glucose">
            <option value="both-hl">Both</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>
      `;
      d3.select('#controls').insert('div', ':first-child').html(filtersHtml);

      const genderSelect  = d3.select('#set-gender');
      const glucoseSelect = d3.select('#set-glucose');

      genderSelect.on('change', () => filter());
      glucoseSelect.on('change', () => filter());

      function filter() {
        const g = genderSelect.node().value;
        const gl = glucoseSelect.node().value;
        const filt = allDataFiles.filter(d => {
          const ok1 = g === 'both-mf' ? true : d.gender === g;
          const ok2 = gl === 'both-hl'  ? true : d.glucose === gl;
          return ok1 && ok2;
        });
        drawChart(filt);
      }

      // Load CSVs
      Promise.all(dataFiles.map(d =>
        d3.csv(d.file, d3.autoType).then(raw => ({ name: d.name, raw }))
      )).then(allData => {
        // Compute maxes
        const flats = cols => allData.flatMap(ds => ds.raw.map(r => r[cols]));
        const maxCal  = d3.max(flats('calorie')),
              maxCarb = d3.max(flats('total_carb')),
              maxSug  = d3.max(flats('sugar')),
              maxProt = d3.max(flats('protein'));

        // Prepare data
        const times = d3.range(0,61,5).map(String);
        const dataSets = allData.map(({ name, raw }) => ({
          name,
          meta: raw,
          seriesRaw: raw.map(d =>
            times.map(t => ({ minute:+t, value:d[t] })).filter(pt => pt.value != null)
          )
        }));

        // Scales and axes
        const width  = +svg.attr('width'),
              height = +svg.attr('height'),
              W      = width - 50,
              H      = height - 50;
        const x = d3.scaleLinear().domain([0,60]).range([40,W]);
        const y = d3.scaleLinear().range([H,10]);

        svg.append('g')
           .attr('transform','translate(0,'+H+')')
           .call(d3.axisBottom(x))
           .append('text')
           .attr('x',W/2)
           .attr('y',35)
           .attr('fill','#000')
           .text('Minutes After Meal');

        svg.append('g')
           .attr('transform','translate(40,0)')
           .call(d3.axisLeft(y))
           .append('text')
           .attr('transform','rotate(-90)')
           .attr('x',-H/2)
           .attr('y',-35)
           .attr('fill','#000')
           .text('Δ Glucose Level (mg/dL)');

        // Zoom behavior
        const zoom = d3.zoom()
          .scaleExtent([1,10])
          .translateExtent([[0,0],[width,height]])
          .extent([[0,0],[width,height]])
          .on('zoom', event => {
            const nx = event.transform.rescaleX(x);
            const ny = event.transform.rescaleY(y);
            svg.select('g.x-axis').call(d3.axisBottom(nx));
            svg.select('g.y-axis').call(d3.axisLeft(ny));
            svg.selectAll('.data-group path')
               .attr('d', d3.line()
                 .x(pt => nx(pt.minute))
                 .y(pt => ny(pt.value))
               );
            svg.selectAll('.data-group circle')
               .attr('cx', pt => nx(pt.minute))
               .attr('cy', pt => ny(pt.value));
          });
        svg.call(zoom);

        // Sliders
        function makeSlider(id,mn,mx) {
          const el = document.getElementById(id);
          if (el.noUiSlider) el.noUiSlider.destroy();
          noUiSlider.create(el, {
            start:[0,mx], connect:true,
            range:{ min:mn, max:mx }, step:1,
            tooltips:[true,true],
            format:{ to:v=>v.toFixed(1), from:v=>+v }
          });
          return el.noUiSlider;
        }
        const sCal = makeSlider('calorie-slider',0,maxCal),
              sCarb= makeSlider('carbs-slider',0,maxCarb),
              sSug = makeSlider('sugar-slider',0,maxSug),
              sProt= makeSlider('protein-slider',0,maxProt);

        // Line generator
        const lineGen = d3.line().x(d=>x(d.minute)).y(d=>y(d.value)).curve(d3.curveBasis);

        // Update chart
        function update() {
          const [c0,c1]=sCal.get().map(Number), [cb0,cb1]=sCarb.get().map(Number);
          const [s0,s1]=sSug.get().map(Number), [p0,p1]=sProt.get().map(Number);
          const seriesData = dataSets.map(ds => {
            const idx = ds.meta.map((m,i) => (m.calorie>=c0&&m.calorie<=c1&&m.total_carb>=cb0&&m.total_carb<=cb1&&m.sugar>=s0&&m.sugar<=s1&&m.protein>=p0&&m.protein<=p1)?i:null).filter(i=>i!=null);
            const agg = times.map(t=>({ minute:+t, value:d3.mean(idx.map(i=>ds.seriesRaw[i].find(pt=>pt.minute===+t)?.value).filter(v=>v!=null)) })).filter(d=>d.value!=null);
            return { name:ds.name, series:agg };
          }).filter(d=>d.series.length);

          y.domain(d3.extent(seriesData.flatMap(d=>d.series.map(pt=>pt.value)))).nice();
          svg.select('g.y-axis').call(d3.axisLeft(y));

          const color = d3.scaleSequential(d3.interpolateViridis).domain([0,seriesData.length-1||1]);

          const groups = svg.selectAll('.data-group').data(seriesData, d=>d.name);
          groups.exit().remove();
          const ge = groups.enter().append('g').attr('class','data-group');

          ge.merge(groups).each(function(d,i){
            // path
            const p = d3.select(this).selectAll('path').data([d.series]);
            p.enter().append('path').merge(p)
              .attr('d', lineGen)
              .attr('fill','none')
              .attr('stroke', color(i))
              .attr('stroke-width',2);
            p.exit().remove();
            // circles
            const cs = d3.select(this).selectAll('circle').data(d.series);
            cs.enter().append('circle').merge(cs)
              .attr('r',3)
              .attr('cx',pt=>x(pt.minute))
              .attr('cy',pt=>y(pt.value))
              .attr('fill',color(i))
              .on('mouseover',(e,pt)=>tooltip.style('opacity',1).html(d.name+'<br>Min:'+pt.minute+'<br>Val:'+pt.value))
              .on('mousemove',e=>tooltip.style('left',e.pageX+5+'px').style('top',e.pageY-5+'px'))
              .on('mouseout',()=>tooltip.style('opacity',0));
            cs.exit().remove();
          });

          // legend
          svg.selectAll('.legend').remove();
          const legend = svg.append('g').attr('class','legend').attr('transform','translate('+(W-120)+',20)');
          seriesData.forEach((d,i)=>{
            const item = legend.append('g').attr('class','legend-item').attr('transform','translate(0,'+i*20+')')
              .on('click',function(){
                const vis = d3.selectAll('.data-group').filter(g=>g.name===d.name)
                  .style('display', function(){ return d3.select(this).style('display')==='none'?'block':'none'; });
              });
            item.append('rect').attr('width',10).attr('height',10).attr('fill',color(i));
            item.append('text').attr('x',15).attr('y',10).text(d.name).attr('font-size','12px');
          });
        }

        [sCal,sCarb,sSug,sProt].forEach(s=>s.on('update', update));
        d3.select('#reset-button').on('click',()=>{
          sCal.set([0,maxCal]); sCarb.set([0,maxCarb]); sSug.set([0,maxSug]); sProt.set([0,maxProt]);
          genderSelect.property('value','both-mf'); glucoseSelect.property('value','both-hl');
          drawChart(allDataFiles);
        });

        // Title
        svg.append('text')
           .attr('x',width/2)
           .attr('y',20)
           .attr('text-anchor','middle')
           .attr('font-size','16px')
           .attr('font-weight','bold')
           .text('Glucose Change vs. Time After Meal');

        update();
      });
    }

    drawChart(allDataFiles);