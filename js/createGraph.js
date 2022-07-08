const minSize = 2;
const maxSize = 15;
const metric = "growth";

async function createGraph() {
  const vals = await d3.json("./data/person-growth.json");
  let lads = (await d3.json("./data/lad-2021.geojson")).features;
  const links = await d3.csv("./data/lad-links.csv");

  const coordAccessor = (d) => d.geometry.coordinates;
  const nameAccessor = (d) => d.name;
  let ladCoord = {};
  lads.forEach((d) => {
    lads.id = d.properties.LAD21CD;
    ladCoord[d.properties.LAD21CD] = coordAccessor(d);
  });
  let ladName = {};
  vals.forEach((d) => {
    ladName[d.code] = nameAccessor(d);
  });

  let ladVals = {};
  vals.forEach((d) => {
    ladVals[d.code] = d[metric];
  });
  const metricAccessor = (d) => {
    const val = ladVals[d.properties.LAD21CD];
    if (!val) {
      return val;
    }
    return val;
    return parseInt(val.replace(/,/g, ""));
  };
  const absMetricAccessor = (d) => Math.abs(metricAccessor(d));
  const rScale = d3
    .scaleLinear()
    .domain(d3.extent(lads, absMetricAccessor))
    .range([minSize, maxSize]);
  const rAccessor = (d) => rScale(absMetricAccessor(d));
  const rSetter = (d, fac) => {
    ladVals[d.properties.LAD21CD] = String(metricAccessor(d) * fac);
  };

  const av = d3.mean(lads, rAccessor);

  let dimensions = {
    width: window.innerWidth * 0.5,
    margin: {
      top: 10,
      right: 10,
      bottom: 20,
      left: 50,
    },
  };
  dimensions.boundedWidth =
    dimensions.width - dimensions.margin.left - dimensions.margin.right;
  dimensions.height = window.innerHeight * 0.9;
  dimensions.boundedHeight =
    dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

  const projection = d3
    .geoAlbers()
    .center([2, 52])
    .rotate([4.4, 0])
    .parallels([50, 60])
    .scale(5000)
    // .scale(dimensions.boundedWidth / 2 / Math.PI)
    .translate([
      dimensions.boundedWidth / 2,
      (dimensions.boundedHeight * 1.35) / 2,
    ])
    .precision(0.1);
  const pathGenerator = d3.geoPath(projection);

  lads.forEach((d) => {
    d.x = projection(coordAccessor(d))[0];
    d.y = projection(coordAccessor(d))[1];
  });

  // Draw the canvas
  const wrapper = d3
    .select("#map")
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height);
  const bounds = wrapper
    .append("g")
    .style(
      "transform",
      `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px`
    );
  const map = bounds.append("g");
  const label = d3.select("#tooltip");

  const simulation = d3
    .forceSimulation(lads)
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => rAccessor(d))
        .strength(1)
    )
    .force(
      "link",
      d3
        .forceLink()
        .links(links)
        .id((d) => d.properties.LAD21CD)
    )
    .on("tick", ticked);

  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  function ticked() {
    map
      .selectAll("line")
      .data(links, (d) => d.index)
      .join(
        (enter) => enter.append("line").attr("class", "link"),
        (update) => {
          update
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);
        }
      );
    map
      .selectAll("circle")
      .data(simulation.nodes(), (d) => d.index)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("r", 0)
            .attr("class", "county")
            .on("mouseenter", onHover)
            .on("mouseout", onExit)
            .call(drag(simulation)),
        (update) => {
          update
            .attr("cx", (d) => {
              // console.log(rAccessor(d));
              return d.x;
            })
            .attr("cy", (d) => d.y)
            .attr("r", (d) => {
              // console.log(d);
              return rAccessor(d);
            })
            .attr("fill", (d) => {
              if (metricAccessor(d) > 0) {
                return "green";
              } else {
                return "red";
              }
            });
        },
        (exit) => exit.remove()
      );
    console.log("tick");
  }

  function onHover(e, d) {
    rSetter(d, 2);
    label.text(
      ladName[d.properties.LAD21CD] +
        ": " +
        Math.round(metricAccessor(d) * 100) +
        "%"
    );
    // simulation.alphaTarget(0.1).restart();
  }
  function onExit(e, d) {
    rSetter(d, 0.5);
  }
}

createGraph();
