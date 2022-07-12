const minSize = d3.select("#min-size-input");
const maxSize = d3.select("#max-size-input");
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
    .scalePow()
    .exponent(2)
    .domain(d3.extent(lads, absMetricAccessor))
    .range([minSize.property("value"), maxSize.property("value")]);
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

  function resetCoords() {
    lads.forEach((d) => {
      d.x = projection(coordAccessor(d))[0];
      d.y = projection(coordAccessor(d))[1];
    });
    map.selectAll("circle").remove();
    rScale.range([minSize.property("value"), maxSize.property("value")]);
    forceCollide.initialize(simulation.nodes());
    simulation.alpha(1).restart();
  }
  const resetButton = d3.select("#reset-map").on("click", resetCoords);

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
  const background = bounds
    .append("rect")
    .attr("width", dimensions.boundedWidth)
    .attr("height", dimensions.boundedHeight)
    .attr("class", "background");
  const map = bounds.append("g");
  const tooltip = d3
    .select("#tooltip-div")
    .style("top", document.getElementById("map").offsetTop + "px")
    .style("left", document.getElementById("map").offsetLeft - 150 + "px");
  const label = d3.select("#tooltip");

  const forceCollide = d3
    .forceCollide()
    .radius((d) => rAccessor(d))
    .strength(1);
  const simulation = d3
    .forceSimulation(lads)
    .alphaDecay(0.2)
    .force("collide", forceCollide)
    .force(
      "link",
      d3
        .forceLink()
        .links(links)
        .id((d) => d.properties.LAD21CD)
    )
    .on("tick", ticked)
    .on("end", fix)
    .stop();
  resetCoords();

  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.1).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0).velocityDecay(0.5);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  function fix() {
    // simulation.nodes().forEach((node) => {
    //   node.fx = node.x;
    //   node.fy = node.y;
    // });
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
            .call(drag(simulation))
            .transition()
            .duration((d) => rAccessor(d) * 100)
            .attr("r", (d) => rAccessor(d)),
        (update) => {
          update
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y)
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
    console.log(rAccessor(d));
    rSetter(d, 1.2);
    console.log(rAccessor(d));
    label.text(
      ladName[d.properties.LAD21CD] +
        ": " +
        Math.round((metricAccessor(d) / 2) * 100) +
        "%"
    );
    forceCollide.initialize(simulation.nodes());
    simulation.alphaTarget(0.1).restart();
  }
  function onExit(e, d) {
    rSetter(d, 1 / 1.2);
    forceCollide.initialize(simulation.nodes());
    simulation.alphaTarget(0).velocityDecay(0.5);
  }
}

createGraph();
