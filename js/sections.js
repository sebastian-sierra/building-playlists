/**
 * scrollVis - encapsulates
 * all the code for the visualization
 * using reusable charts pattern:
 * http://bost.ocks.org/mike/chart/
 */
var scrollVis = function () {
    // constants to define the size
    // and margins of the vis area.
    var width = 800;
    var height = 600;
    var margin = {top: 0, left: 20, bottom: 40, right: 10};

    // Keep track of which visualization
    // we are on and which was the last
    // index activated. When user scrolls
    // quickly, we want to call all the
    // activate functions that they pass.
    var lastIndex = -1;
    var activeIndex = 0;

    // Sizing for the grid visualization
    var squareSize = 6;
    var squarePad = 2;
    var numPerRow = width / (squareSize + squarePad);

    // main svg used for visualization
    var svg = null;

    // d3 selection that will be used
    // for displaying visualizations
    var g = null;

    // When scrolling to a new section
    // the activation function for that
    // section is called.
    var activateFunctions = [];
    // If a section has an update function
    // then it is called while scrolling
    // through the section with the current
    // progress through the section.
    var updateFunctions = [];

    //Node tooltip
    const tooltipDiv = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // Color scale for edges
    const color = d3.scaleOrdinal(d3.schemeCategory20);

    const legend = d3.legendColor()
        .shape('circle')
        .shapeRadius('4')
        .orient('vertical')
        .classPrefix('legend');

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink()
            .id(d => d.id))
        .force('collide', d3.forceCollide(30))
        .force('center', d3.forceCenter((width / 2), height / 2))
        .force('genreX', d3.forceX(genreX)
            .strength(0.02))
        .force('genreY', d3.forceY(genreY));

    const tree = d3.tree()
        .size([width-100, height - 100]);

    const pointScale = d3.scalePoint()
        .padding(0.5)
        .rangeRound([0, width]);

    /**
     * chart
     *
     * @param selection - the current d3 selection(s)
     *  to draw the visualization in. For this
     *  example, we will be drawing it in #vis
     */
    var chart = function (selection) {
        selection.each(function (rawData) {
            // create svg and give it a width and height
            svg = d3.select(this)
                .selectAll('svg')
                .data([0]);
            var svgE = svg.enter()
                .append('svg');
            // @v4 use merge to combine enter and existing selection
            svg = svg.merge(svgE);

            svg.append('defs')
                .append('filter')
                .attr('id', 'greyscale')
                .append('feColorMatrix')
                .attr('type', 'matrix')
                .attr('values', `0 1 0 0 0
                  0 1 0 0 0
                  0 1 0 0 0
                  0 1 0 1 0 `);

            svg.attr('width', width + margin.left + margin.right);
            svg.attr('height', height + margin.top + margin.bottom);

            svg.append('g');

            // this group element will be used to contain all
            // other elements.
            g = svg.select('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            setupVis(rawData);

        });
    };

    /**
     * setupVis - creates initial elements for all
     * sections of the visualization.
     *
     * @param wordData - data object for each word.
     * @param fillerCounts - nested data that includes
     *  element for each filler word type.
     * @param histData - binned histogram data
     */
    var setupVis = function (rawData) {

        const graph = rawData[0];
        const treeData = rawData[1];

        // count openvis title
        g.append('text')
            .attr('class', 'title vis-title')
            .attr('x', width / 2)
            .attr('y', height / 3)
            .text('Building playlists');

        g.append('text')
            .attr('class', 'sub-title vis-title')
            .attr('x', width / 2)
            .attr('y', (height / 3) + (height / 5))
            .text('A MST (Minimum spanning tree) approach');

        g.selectAll('.vis-title')
            .attr('opacity', 0);

        //Links color legend

        const types = d3.set(graph.edges.map(e => e.type)).values();
        color.domain(types);

        g.append('g')
            .attr('class', 'category-legend')
            .attr('transform', `translate(${width-100}, 20)`);

        legend.scale(color);

        g.select('.category-legend')
            .attr('opacity', 0)
            .call(legend);


        //graph links
        let links = g.append('g')
            .classed('links', true)
            .selectAll('line')
            .data(graph.edges);

        const linksE = links.enter()
            .append('line')
            .classed('link', true);

        links = links.merge(linksE)
            .attr('stroke-width', 1)
            .style('stroke', e => color(e.type))
            .on('mouseover', d => {
                d3.selectAll('.legendlabel')
                    .filter(l => l === d.type)
                    .classed('legend-hover', true);
            })
            .on('mouseout', () => {
                d3.selectAll('.legendlabel')
                    .classed('legend-hover', false);
            })
            .attr('opacity', 0);

        let nodes = g.append('g')
            .classed('nodes', true)
            .selectAll('.node')
            .data(graph.nodes, d => d.id);

        const nodesE = nodes.enter()
            .append('g')
            .classed('node', true);

        nodes = nodes.merge(nodesE)
            .attr('opacity', 0);

        nodes
            .append('image')
            .attr('xlink:href', d => d.img)
            .attr('x', -25)
            .attr('y', -25)
            .attr('width', 50)
            .attr('height', 50);


        simulation
            .nodes(graph.nodes)
            .on('tick', ticked);

        simulation.force('link')
            .links(graph.edges);

        simulation.stop();

        function ticked() {
            links.attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
        }

        //Sets up the MST
        const root = d3.hierarchy(treeData.source);
        let preOrder = [];

        root.eachAfter(n => preOrder.push(n.data.id));

        pointScale.domain(preOrder);

        let treeLinks = g.append('g')
            .classed('tree-links', true)
            .attr('transform', 'translate(0, 50)')
            .selectAll('.tree-link')
            .data(tree(root)
                .links());

        const treeLinksE = treeLinks.enter()
            .append('path')
            .classed('tree-link', true);

        treeLinks = treeLinks.merge(treeLinksE)
            .attr('stroke', d => color(genreFromEdge(d)))
            .attr('d', d3.linkVertical()
                .x(d => d.x)
                .y(d => d.y))
            .attr('opacity', 0);


        function genreFromEdge(edge) {
            return treeData.links.find(l => edge.source.data.id === l.source && edge.target.data.id === l.target).type;
        }

        setupSections(graph, root);

    };

    /**
     * setupSections - each section is activated
     * by a separate function. Here we associate
     * these functions to the sections based on
     * the section's index.
     *
     */
    var setupSections = function (graph, root) {
        // activateFunctions are called each
        // time the active section changes
        activateFunctions[0] = showTitle;
        activateFunctions[1] = showGraph.bind(this, graph);
        activateFunctions[2] = showTree.bind(this, root);
        activateFunctions[3] = showList;
        activateFunctions[4] = showNames;

        // updateFunctions are called while
        // in a particular section to update
        // the scroll progress in that section.
        // Most sections do not need to be updated
        // for all scrolling and so are set to
        // no-op functions.
        for (var i = 0; i < 9; i++) {
            updateFunctions[i] = function () {
            };
        }
    };

    /**
     * ACTIVATE FUNCTIONS
     *
     * These will be called their
     * section is scrolled to.
     *
     * General pattern is to ensure
     * all content for the current section
     * is transitioned in, while hiding
     * the content for the previous section
     * as well as the next section (as the
     * user may be scrolling up or down).
     *
     */

    /**
     * showTitle - initial title
     *
     * hides: count title
     * (no previous step to hide)
     * shows: intro title
     *
     */
    function showTitle() {

        //Hide tooltip
        tooltipDiv.transition()
            .duration(0)
            .style('opacity', 0);

        //Hide graph

        simulation.stop();

        g.selectAll('.link')
            .on('mouseover', null)
            .on('mouseout', null)
            .transition()
            .duration(0)
            .attr('opacity', 0);

        g.selectAll('.node')
            .on('mouseover', null)
            .on('mouseout', null)
            .on('click', null)
            .classed('invisible', true)
            .transition(0)
            .duration(600)
            .attr('opacity', 0);

        //Hide legend
        g.select('.category-legend')
            .transition()
            .duration(0)
            .attr('opacity', 0);

        //Remove legend listeners
        //Change legend listeners
        legend
            .on('cellover', null)
            .on('cellout', null);


        //Show title
        g.selectAll('.vis-title')
            .transition()
            .duration(600)
            .attr('opacity', 1.0);

    }

    function showGraph(graph) {

        //Hide tooltip
        tooltipDiv.transition()
            .duration(0)
            .style('opacity', 0);

        //Hide title
        g.selectAll('.vis-title')
            .transition()
            .duration(600)
            .attr('opacity', 0);

        //Hide tree edges
        g.selectAll('.tree-link')
            .transition()
            .duration(0)
            .attr('opacity', 0);

        //Show graph
        g.select('.nodes')
            .attr('transform', 'translate(0, 0)');

        g.selectAll('.link')
            .transition()
            .duration(600)
            .attr('opacity', 1);

        g.selectAll('.node')
            .data(graph.nodes, d => d.data ? d.data.id : d.id)
            .classed('invisible', false)
            .on('mouseover', (d, i, nodes) => onMouseOverGraphNode(d, i, nodes, graph))
            .on('mouseout', onMouseOutGraphNode)
            .transition()
            .duration(600)
            .attr('opacity', 1);

        simulation.restart();

        //Show legend
        g.select('.category-legend')
            .transition()
            .duration(600)
            .attr('opacity', 1);

        legend
            .on('cellover', c => onMouseOverCellLegendGraph(c, graph))
            .on('cellout', onMouseOutCellLegend);

    }

    function showTree(root) {

        //Hide tooltip
        tooltipDiv.transition()
            .duration(0)
            .style('opacity', 0);

        simulation.stop();

        g.selectAll('.link')
            .on('mouseover', null)
            .on('mouseout', null)
            .transition()
            .duration(0)
            .attr('opacity', 0);

        //Show legend
        g.select('.category-legend')
            .transition()
            .duration(600)
            .attr('opacity', 1);

        //Show tree
        g.selectAll('.tree-link')
            .transition()
            .duration(600)
            .attr('opacity', 1);

        g.select('.nodes')
            .attr('transform', 'translate(0, 50)')
            .raise();

        const nodes = g.selectAll('.node')
            .on('mouseover', onMouseOverTreeNode)
            .on('mouseout', onMouseOutTreeNode)
            .data(root.descendants(), d => d.data ? d.data.id : d.id);

        nodes.exit()
            .on('mouseover', null)
            .on('mouseout', null)
            .transition()
            .duration(0)
            .attr('opacity', 0);

        //Update node size locations
        nodes.select('image')
            .transition()
            .duration(500)
            .attr('x', -25)
            .attr('y', -25)
            .attr('width', 50)
            .attr('height', 50);

        nodes.transition()
            .duration(500)
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .attr('opacity', 1);

        //Change legend listeners
        legend
            .on('cellover', null)
            .on('cellout', null);


    }

    function showList() {

        //Hide tooltip
        tooltipDiv.transition()
            .duration(0)
            .style('opacity', 0);

        //Hide legend
        g.select('.category-legend')
            .transition()
            .duration(0)
            .attr('opacity', 0);

        //Hide tree links and remove margin
        g.selectAll('.tree-link')
            .transition()
            .duration(0)
            .attr('opacity', 0);

        g.select('.nodes')
            .transition()
            .duration(0)
            .attr('transform', 'translate(0, 0)');

        const nodes = g.selectAll('.node')
            .filter(d => d.data !== undefined);

        //Remove text
        nodes.select('text')
            .transition()
            .duration(0)
            .remove();

        //Update node size locations
        pointScale.range([0, width]);

        nodes
            .on('mouseover', onMouseOverHorizontalListNode)
            .on('mouseout', onMouseOutHortizontalListNode)
            .classed('greyed', false)
            .select('image')
            .transition()
            .duration(500)
            .attr('x', -12)
            .attr('y', -12)
            .attr('width', 24)
            .attr('height', 24);

        nodes
            .transition()
            .duration(1000)
            .attr('opacity', 1)
            .attr('transform', d => `translate(${pointScale(d.data.id)}, ${height / 2})`);

    }

    function showNames() {

        //Hide tooltip
        tooltipDiv.transition()
            .duration(0)
            .style('opacity', 0);

        //Move artists and append text
        pointScale.range([0, height]);

        const nodes = g.selectAll('.node')
            .filter(d => d.data !== undefined);

        nodes
            .on('mouseover', onMouseOverVerticalListNode)
            .on('mouseout', onMouseOutVerticalListNode)
            .transition()
            .duration(500)
            .attr('opacity', 1)
            .attr('transform', d => `translate(60, ${pointScale(d.data.id)})`);


        nodes
            .append('text')
            .classed('artists-name', true)
            .transition()
            .duration(500)
            .attr('x', 50)
            .attr('y', 5)
            .text(d => d.data.name);

    }


    /**
     * DATA FUNCTIONS
     *
     * Used to coerce the data into the
     * formats we need to visualize
     *
     */

    function isAdjacent(source, node, graph) {
        return graph.edges.filter(
            e => e.source.id === source.id || e.target.id === source.id)
                .find(e => e.target.id === node.id || e.source.id === node.id) !==
            undefined;
    }

    function isAncestor(des, ans) {
        return des.ancestors()
                .find(a => a.data.id === ans.data.id) !== undefined ||
            ans.ancestors()
                .find(a => a.data.id === des.data.id) !== undefined;
    }

    function genreX(n) {
        const genres = n.genres.join('-');
        if (genres.includes('hip hop') || genres.includes('rap')) {
            return width / 4 * 3;
        } else if (genres.includes('house')) {
            return width / 4;
        } else {
            return width;
        }
    }

    function genreY(n) {
        const genres = n.genres.join('-');
        if (genres.length === 0 && !genres.includes('hip hop') && !genres.includes('rap') && genres.includes('house')) {
            return height / 4;
        } else {
            return height / 2;
        }
    }

    /**
     * EVENT HANDLERS
     *
     * Used for interactions with various of the page elements
     *
     */

    function onMouseOverGraphNode(d, i, nodes, graph) {
        svg.selectAll('.links line')
            .transition()
            .duration(200)
            .attr('opacity',
                e => d.id === e.source.id || d.id === e.target.id ? 1 : 0);

        tooltipDiv.transition()
            .duration(200)
            .style('opacity', 0.7);
        tooltipDiv.html(`${d.name}`)
            .style('left', d3.event.pageX + 'px')
            .style('top', d3.event.pageY + 'px');

        d3.selectAll(nodes)
            .select('image')
            .classed('greyed', n => n.id !== d.id && !isAdjacent(d, n, graph))
            .transition()
            .duration(200)
            .attr('x', n => isAdjacent(d, n, graph) ? -33 : -25)
            .attr('y', n => isAdjacent(d, n, graph) ? -33 : -25)
            .attr('width', n => isAdjacent(d, n, graph) ? 66 : 50)
            .attr('height', n => isAdjacent(d, n, graph) ? 66 : 50);

        d3.select(nodes[i])
            .select('image')
            .transition()
            .duration(200)
            .attr('x', -40)
            .attr('y', -40)
            .attr('width', 80)
            .attr('height', 80);

        d3.selectAll('.legendlabel')
            .filter(l => {
                return graph.edges.filter(
                    e => e.source.id === d.id || e.target.id === d.id)
                    .map(e => e.type)
                    .includes(l);
            })
            .classed('legend-hover', true);

    }

    function onMouseOutGraphNode(d, i, nodes) {
        svg.selectAll('.links line')
            .transition()
            .duration(200)
            .attr('opacity', 1)
            .attr('stroke-width', 1)
            .style('stroke', e => color(e.type));

        tooltipDiv.transition()
            .duration(200)
            .style('opacity', 0);

        d3.selectAll(nodes)
            .select('image')
            .classed('greyed', false)
            .transition()
            .duration(200)
            .attr('x', -25)
            .attr('y', -25)
            .attr('width', 50)
            .attr('height', 50);

        d3.selectAll('.legendlabel')
            .classed('legend-hover', false);

    }

    function onMouseOverTreeNode(d, i, nodes) {
        //Show tooltip
        tooltipDiv.transition()
            .duration(200)
            .style('opacity', 0.7);
        tooltipDiv.html(`${d.data.name}`)
            .style("left", d3.event.pageX + "px")
            .style("top", d3.event.pageY + "px");

        //Select ancestors
        d3.selectAll(nodes)
            .select('image')
            .filter(n => n.data !== undefined && isAncestor(d, n))
            .transition()
            .duration(200)
            .attr('x', -33)
            .attr('y', -33)
            .attr('width', 66)
            .attr('height', 66);

        d3.selectAll(nodes)
            .filter(n => n.data !== undefined && !isAncestor(d, n))
            .select('image')
            .classed('greyed', true);

        //Select current
        d3.select(nodes[i])
            .select('image')
            .transition()
            .duration(200)
            .attr('x', -40)
            .attr('y', -40)
            .attr('width', 80)
            .attr('height', 80);
    }

    function onMouseOutTreeNode(d, i, nodes) {
        //Remove tooltip
        tooltipDiv.transition()
            .duration(200)
            .style('opacity', 0);

        //Deselect all
        d3.selectAll(nodes)
            .select('image')
            .classed('greyed', false)
            .transition()
            .duration(200)
            .attr('x', -25)
            .attr('y', -25)
            .attr('width', 50)
            .attr('height', 50);
    }

    function onMouseOverHorizontalListNode(d, i, nodes) {
        //Show tooltip
        tooltipDiv.transition()
            .duration(200)
            .style('opacity', 0.7);
        tooltipDiv.html(`${d.data.name}`)
            .style("left", d3.event.pageX + "px")
            .style("top", d3.event.pageY + "px");

        //Grey all
        d3.selectAll(nodes)
            .filter(n => n.data !== undefined)
            .select('image')
            .classed('greyed', true);

        //Select current
        d3.select(nodes[i])
            .raise()
            .select('image')
            .classed('greyed', false)
            .transition()
            .duration(200)
            .attr('x', -40)
            .attr('y', -40)
            .attr('width', 80)
            .attr('height', 80);
    }

    function onMouseOutHortizontalListNode(d, i, nodes) {
        //Remove tooltip
        tooltipDiv.transition()
            .duration(200)
            .style('opacity', 0);

        //Deselect all
        d3.selectAll(nodes)
            .select('image')
            .classed('greyed', false)
            .transition()
            .duration(200)
            .attr('x', -12)
            .attr('y', -12)
            .attr('width', 24)
            .attr('height', 24);

    }

    function onMouseOverVerticalListNode(d, i, nodes) {

        //Grey all
        d3.selectAll(nodes)
            .filter(n => n.data !== undefined)
            .select('image')
            .classed('greyed', true);

        //Select current
        const node = d3.select(nodes[i])
            .raise();

        node
            .select('image')
            .classed('greyed', false)
            .transition()
            .duration(200)
            .attr('x', -40)
            .attr('y', -40)
            .attr('width', 80)
            .attr('height', 80);

        node.select('text')
            .classed('artists-name-hover', true)
            .transition()
            .duration(200);

    }

    function onMouseOutVerticalListNode(d, i, nodes) {
        //Deselect all
        const nodesS = d3.selectAll(nodes);

        nodesS
            .select('image')
            .classed('greyed', false)
            .transition()
            .duration(200)
            .attr('x', -12)
            .attr('y', -12)
            .attr('width', 24)
            .attr('height', 24);

        nodesS
            .select('text')
            .classed('artists-name-hover', false)
            .transition()
            .duration(200)

    }

    function onMouseOverCellLegendGraph(c, graph) {
        d3.selectAll('.links line')
            .transition().duration(200)
            .attr('opacity', d => d.type === c ? 1 : 0);

        d3.selectAll('.node image')
            .filter(n => {
                return graph.edges
                    .filter(e => e.type === c)
                    .find(e => e.source.id === n.id || e.target.id === n.id) !== undefined;
            })
            .attr('x', n => -33)
            .attr('y', n => -33)
            .attr('width', 66)
            .attr('height', 66);
    }

    function onMouseOutCellLegend(c) {
        d3.selectAll('.links line')
            .transition().duration(200)
            .attr('opacity', 1);

        d3.selectAll('.node image')
            .attr('x', n => -25)
            .attr('y', n => -25)
            .attr('width', 50)
            .attr('height', 50);
    }

    /**
     * activate -
     *
     * @param index - index of the activated section
     */
    chart.activate = function (index) {
        activeIndex = index;
        var sign = (activeIndex - lastIndex) < 0 ? -1 : 1;
        var scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);
        scrolledSections.forEach(function (i) {
            activateFunctions[i]();
        });
        lastIndex = activeIndex;
    };

    /**
     * update
     *
     * @param index
     * @param progress
     */
    chart.update = function (index, progress) {
        updateFunctions[index](progress);
    };

    // return chart function
    return chart;
};

/**
 * display - called once data
 * has been loaded.
 * sets up the scroller and
 * displays the visualization.
 *
 * @param data - loaded tsv data
 */
function display(data) {
    // create a new plot and
    // display it
    var plot = scrollVis();
    d3.select('#vis')
        .datum(data)
        .call(plot);

    // setup scroll functionality
    var scroll = scroller()
        .container(d3.select('#graphic'));

    // pass in .step selection as the steps
    scroll(d3.selectAll('.step'));

    // setup event handling
    scroll.on('active', function (index) {

        // highlight current step text
        d3.selectAll('.step')
            .style('opacity', function (d, i) {
                return i === index ? 1 : 0.1;
            });

        // activate current section
        plot.activate(index);
    });

    scroll.on('progress', function (index, progress) {
        d3.select('.tooltip')
            .transition()
            .duration(0)
            .style('opacity', 0);

        plot.update(index, progress);
    });
}

d3.queue()
    .defer(d3.json, 'data/top50.json')
    .defer(d3.json, 'data/top50tree.json')
    .awaitAll((error, results) => {
        display(results);
    });
