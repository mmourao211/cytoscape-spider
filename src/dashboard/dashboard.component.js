/// <reference path="../../node_modules/@types/angular/index.d.ts" />
/// <reference path="../../node_modules/@types/lodash/index.d.ts" />
'use strict';
(function () {
    angular.module('app')
        .component('dashboard', {
        templateUrl: 'dashboard/dashboard.html',
        controller: DashboardController,
        controllerAs: 'vm'
    });
    var RiskCategory;
    (function (RiskCategory) {
        RiskCategory[RiskCategory["None"] = 0] = "None";
        RiskCategory[RiskCategory["Low"] = 1] = "Low";
        RiskCategory[RiskCategory["Medium"] = 2] = "Medium";
        RiskCategory[RiskCategory["High"] = 3] = "High";
    })(RiskCategory || (RiskCategory = {}));
    var FileType;
    (function (FileType) {
        FileType[FileType["Spreadsheets"] = 0] = "Spreadsheets";
        FileType[FileType["Databases"] = 1] = "Databases";
    })(FileType || (FileType = {}));
    DashboardController.$inject = ['$element', '$scope', '$q', '$timeout', '$window', '$compile'];
    function DashboardController($element, $scope, $q, $timeout, $window, $compile) {
        var vm = this;
        vm.dc = dc;
        vm.currentLayout = 'tree';
        var dataset, dict, s, ndx, typeDimension, nodesInFilteredSet;
        var levelCounters = [];
        var sizeCounters = [];
        var totalCount = 0;
        var startingLevel = 1;
        function focusNode(node) {
            sigma.misc.animation.camera(s.camera, {
                x: node['read_cammain:x'],
                y: node['read_cammain:y'],
                ratio: 1
            }, {
                duration: 150
            });
        }
        var refreshGraph = function () {
            s.refresh();
            s.refresh();
            // s.graph.nodes()[0] && focusNode(s.graph.nodes()[0])
        };
        // get exported json from cytoscape desktop via ajax
        var graphP = function () { return $.ajax({
            url: '../../data/example.json?_=' + new Date().getTime(),
            //url: '../../data/example-3276.json?_=' + new Date().getTime(), // wine-and-cheese.json
            // url: './data.json',
            type: 'GET',
            dataType: 'json'
        }); };
        var doesNodeAlreadyExist = function (id) { return !!s.graph.nodes(id); };
        var drawNodesStartingAtRoot = function (root, convertedData, ommitStartingEdge) {
            var nodeAlreadyExists = doesNodeAlreadyExist(root.n);
            if (!nodeAlreadyExists) {
                var nodeToAdd = addCyDataToQueue(convertedData, root.n, root.parentName, 'child', undefined, undefined, undefined, ommitStartingEdge);
            }
            if (root.c.length)
                for (var i = 0; i < root.c.length; i++) {
                    drawNodesStartingAtRoot(root.c[i], convertedData, false);
                }
        };
        var populateLevelCounts = function (root) {
            if (!levelCounters[root.level])
                levelCounters[root.level] = 0;
            levelCounters[root.level]++;
            if (root.c.length)
                for (var i = 0; i < root.c.length; i++)
                    populateLevelCounts(root.c[i]);
        };
        var getMaxLevel = function () {
            return levelCounters.length - 1;
        };
        var drawUpwards = function (root) {
            var first = root;
            vm.breadcrumbs = [root.n];
            var childName;
            while (root.parentName) {
                root = dict[root.parentName];
                vm.breadcrumbs.unshift(root.n);
            }
        };
        vm.stop = function () {
            s.stopForceAtlas2();
            vm.started = false;
        };
        vm.start = function () {
            vm.started = true;
            s.startForceAtlas2({
                gravity: 1,
                scalingRatio: 1,
                strongGravityMode: false,
                linLogMode: false,
                outboundAttractionDistribution: false,
                adjustSizes: false,
                edgeWeightInfluence: 0.1,
                iterationsPerRender: 10,
                startingIterations: 10
            });
        };
        // test
        var drawNodes = function (id) {
            var root = dict[id];
            var convertedData = { nodes: [], edges: [] };
            levelCounters = [];
            sizeCounters = [];
            totalCount = 0;
            startingLevel = root.level;
            nodesInFilteredSet = undefined;
            populateLevelCounts(root);
            getY(root);
            drawUpwards(root);
            vm.nodesCount = 0;
            vm.linksCount = 0;
            vm.databasesCount = 0;
            vm.spreadsheetsCount = 0;
            drawNodesStartingAtRoot(root, convertedData, true);
            s.graph.read(convertedData);
            vm.filteredNodesCount = vm.nodesCount;
            vm.typeChart = dc.pieChart('.type-chart');
            ndx = crossfilter(convertedData.nodes);
            var all = ndx.groupAll();
            var addPercentageLabel = function (graph) {
                graph.label(function (d) {
                    if (graph.hasFilter() && !graph.hasFilter(d.key)) {
                        return d.key + '(0%)';
                    }
                    var label = d.key;
                    if (all.value()) {
                        label += '(' + Math.floor(d.value / all.value() * 100) + '%)';
                    }
                    return label;
                });
            };
            typeDimension = ndx.dimension(function (d) {
                return d.filetype == FileType.Databases ? 'Database' : 'Spreadsheet';
            });
            var typeGroup = typeDimension.group();
            vm.typeChart /* dc.pieChart('#gain-loss-chart', 'chartGroup') */
                .width(180)
                .height(180)
                .radius(80)
                .dimension(typeDimension)
                .group(typeGroup)
                .on('filtered', function () {
                filterChangeCallback();
            });
            addPercentageLabel(vm.typeChart);
            var riskDimension = ndx.dimension(function (d) {
                switch (d.riskCategory) {
                    case RiskCategory.High: return 'High';
                    case RiskCategory.Medium: return 'Medium';
                    case RiskCategory.Low: return 'Low';
                    case RiskCategory.None: return 'None';
                }
            });
            var riskGroup = riskDimension.group();
            vm.riskChart = dc.pieChart('.risk-chart');
            var riskColors = ['#000', '#0f0', '#ff0', '#f00'];
            vm.riskChart /* dc.pieChart('#gain-loss-chart', 'chartGroup') */
                .width(180)
                .height(180)
                .radius(80)
                .dimension(riskDimension)
                .group(riskGroup)
                .colors(riskColors)
                .colorAccessor(function (g) {
                return RiskCategory[g.key] / riskColors.length;
            })
                .on('filtered', function () {
                filterChangeCallback();
            });
            addPercentageLabel(vm.riskChart);
            var existsDimension = ndx.dimension(function (d) {
                return d.exists ? 'Found' : 'Not Found';
            });
            var existsGroup = existsDimension.group();
            vm.existsChart = dc.pieChart('.exists-chart');
            vm.existsChart /* dc.pieChart('#gain-loss-chart', 'chartGroup') */
                .width(180)
                .height(180)
                .radius(80)
                .dimension(existsDimension)
                .group(existsGroup)
                .on('filtered', function () {
                filterChangeCallback();
            });
            addPercentageLabel(vm.existsChart);
            var dateDim = ndx.dimension(function (d) {
                return d.modified;
            });
            var minDate = dateDim.bottom(1)[0].modified;
            var maxDate = dateDim.top(1)[0].modified;
            vm.modifiedChart = dc.barChart(".modified-date-chart")
                .width(600)
                .height(100)
                .margins({ top: 0, right: 50, bottom: 20, left: 40 })
                .dimension(dateDim)
                .group(dateDim.group(function (date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }))
                .x(d3.time.scale().domain([minDate, maxDate]))
                .round(d3.time.day.round)
                .alwaysUseRounding(true)
                .xUnits(d3.time.days)
                .on('filtered', function () {
                filterChangeCallback();
            });
            var linkDim = ndx.dimension(function (d) {
                return d.links;
            });
            var minLinks = linkDim.bottom(1)[0].links;
            var maxLinks = linkDim.top(1)[0].links;
            vm.linksChart = dc.barChart(".links-chart")
                .width(600)
                .height(100)
                .margins({ top: 0, right: 50, bottom: 20, left: 40 })
                .dimension(linkDim)
                .group(linkDim.group())
                .round(dc.round.floor)
                .x(d3.scale.linear().domain([minLinks - 0.5, maxLinks + 0.5]))
                .xUnits(dc.units.integers)
                .centerBar(true)
                .on('filtered', function () {
                filterChangeCallback();
            });
            dc.renderAll();
            if (vm.currentLayout == 'fractal') {
                vm.start();
            }
            $timeout(function () {
                resizeCanvas();
                refreshGraph();
            });
        };
        var filterChangeCallback = function () {
            var filteredNodes = typeDimension.top(Infinity);
            vm.filteredNodesCount = filteredNodes.length;
            nodesInFilteredSet = _.keyBy(filteredNodes, 'id');
            _.each(s.graph.nodes(), function (node) {
                assignNodeColor(node);
            });
            if (!$scope.$$phase && !$scope.$root.$$phase)
                $scope.$apply();
            refreshGraph();
        };
        // when both graph export json and style loaded, init cy
        vm.refreshAll = function (id) { return $q.all([graphP()]).then(function (data) {
            initCy(data);
            drawNodes(id ? id : dataset.n);
        }); };
        var getEdgeId = function (parentName, childName) { return parentName + " to " + childName; };
        var edgeExists = function (parentName, childName) { return !!s.graph.edges(getEdgeId(parentName, childName)); };
        var getSize = function (node) { return 100 * Math.sqrt(node.count / (2 * Math.PI * totalCount)); };
        var getY = function (self) {
            if (!totalCount)
                totalCount = self.count;
            if (!sizeCounters[self.level])
                sizeCounters[self.level] = 0;
            self.size = getSize(self);
            if (self.level == getMaxLevel()) {
                sizeCounters[self.level] += self.size + 10;
                self.y = sizeCounters[self.level] - self.size / 2;
            }
            else {
                if (self.c.length) {
                    var first, last;
                    for (var i = 0; i < self.c.length; i++) {
                        var child = self.c[i];
                        child.y = getY(child);
                        if (i == 0)
                            first = child;
                        if (i == self.c.length - 1)
                            last = child;
                    }
                    self.y = (first.y + last.y) / 2;
                    sizeCounters[self.level] = last.y + last.size / 2 + 10;
                }
                else {
                    for (var j = self.level; j < getMaxLevel() + 1; j++) {
                        sizeCounters[self.level] += self.size + 10;
                    }
                    self.y = sizeCounters[self.level] - self.size / 2;
                }
            }
            return self.y;
        };
        var assignNodeColor = function (node) {
            switch (node.riskCategory) {
                case RiskCategory.High:
                    node.color = '#f00';
                    break;
                case RiskCategory.Medium:
                    node.color = '#ff0';
                    break;
                case RiskCategory.Low:
                    node.color = '#0f0';
                    break;
                default:
                    node.color = '#000';
            }
            if (nodesInFilteredSet && !nodesInFilteredSet[node.id]) {
                node.color = '#bbb';
            }
        };
        var addCyDataToQueue = function (convertedData, childName, parentName, whatToAdd, y, x, size, ommitEdge) {
            var child = dict[childName];
            var parent = dict[parentName];
            var datasetNode = whatToAdd == 'parent' ? parent : child;
            size = size !== undefined ? size : getSize(datasetNode);
            var cyNode = {
                data: {
                    id: datasetNode.n,
                    ancestors: datasetNode.ancestorList
                },
                position: null,
                style: null
            };
            convertedData.nodes.push(cyNode.data);
            vm.nodesCount++;
            if (datasetNode.t == FileType.Databases)
                vm.databasesCount++;
            else
                vm.spreadsheetsCount++;
            if (parentName && !ommitEdge && !edgeExists(parentName, childName)) {
                var edge = {
                    data: {
                        id: getEdgeId(parentName, childName),
                        source: parent.n,
                        target: child.n,
                        size: ommitEdge ? 10 : getSize(child) / 4,
                        weight: ommitEdge ? 10 : getSize(child) / 4
                    }
                };
                convertedData.edges.push(edge.data);
                vm.linksCount++;
            }
            cyNode.data['size'] = size;
            cyNode.data['mass'] = whatToAdd == 'child' ? size : 0;
            cyNode.data['descendants'] = datasetNode.count;
            cyNode.data['links'] = datasetNode.c.length;
            cyNode.data['filetype'] = datasetNode.t;
            cyNode.data['riskCategory'] = datasetNode.rc;
            cyNode.data['modified'] = new Date(datasetNode.md);
            cyNode.data['exists'] = datasetNode.e;
            cyNode.data['type'] = datasetNode.t == FileType.Databases ? 'square' : 'def';
            assignNodeColor(cyNode.data);
            if (vm.currentLayout == 'tree') {
                var base = 1.1;
                var A = sizeCounters[getMaxLevel()] / 5;
                var newMaxLevel = getMaxLevel() - startingLevel + 1;
                var newLevel = datasetNode.level - startingLevel + 1;
                var X = A / (Math.pow(base, newMaxLevel - 1) - 0.999);
                cyNode.position = {
                    x: y !== undefined ? y : datasetNode.y,
                    y: x !== undefined ? x : Math.pow(base, newMaxLevel - newLevel) * X * (Math.pow(base, newLevel - 1) - 1)
                };
            }
            cyNode.data.x = vm.currentLayout == 'tree' ? cyNode.position.x : Math.random();
            cyNode.data.y = vm.currentLayout == 'tree' ? cyNode.position.y : Math.random();
            return cyNode;
        };
        var getChildrenCount = function (parent) {
            if (!parent.count)
                parent.count = _.sumBy(parent.c, function (child) { return getChildrenCount(child); }) + 1;
            return parent.count;
        };
        var createLibraryData = function (root, parentName, level, ancestorList) {
            if (!level)
                level = 1;
            dict[root.n] = root;
            root.count = getChildrenCount(root);
            if (!parentName)
                totalCount = root.count;
            root.level = level;
            root.ancestorList = ancestorList;
            root.parentName = parentName;
            _.each(root.c, function (child) { return createLibraryData(child, root.n, level + 1, ancestorList + (" -" + root.n + "- ")); });
        };
        vm.draw = function () {
            vm.refreshAll();
        };
        var resizeCanvas = function () {
            var canvas = $element.find('.canvas');
            var container = $element.find('.canvas-container');
            var width = vm.toggled ? container.width() : container.width() + 1024;
            canvas.height(container.height());
            canvas.width(width);
        };
        $($window).resize(resizeCanvas);
        function initCy(then) {
            dataset = then[0];
            dict = {};
            createLibraryData(dataset, null, null, '');
            killAll();
            var element = $element.find('.canvas')[0];
            s = new sigma({
                renderers: [{
                        container: element,
                        settings: {
                            edgeColor: 'target',
                            hideEdgesOnMove: true,
                        }
                    }]
            });
            var tooltip = $('.canvas').qtip({
                id: 'canvas',
                prerender: true,
                content: ' ',
                position: {
                    target: 'mouse',
                    viewport: $('.canvas')
                },
                show: false,
                hide: {
                    event: false,
                    fixed: true
                }
            });
            // Grab the API reference
            var graph = $('.canvas'), api = graph.qtip();
            s.bind('click', function () {
                graph.qtip('hide', true);
            });
            s.bind('clickNode', function (eventArgs) {
                $timeout(function () { return vm.selectedNode = {}; });
                $timeout(function () { return vm.selectedNode = {
                    name: eventArgs.data.node.id,
                    filetype: FileType[eventArgs.data.node.filetype],
                    children: dict[eventArgs.data.node.id].c,
                    riskCategory: RiskCategory[eventArgs.data.node.riskCategory]
                }; }, 2000);
                api.set('content.text', $compile("\n                <div>\n                  <div><button class=\"btn-xs btn-default\" ng-click=\"vm.refreshAll('" + eventArgs.data.node.id + "')\">Start from Here</button></div>\n                  <div>Name: {{vm.selectedNode.name}}<div>\n                  <div>Filetype: {{vm.selectedNode.filetype}}<div>\n                  <div>Risk Category: {{vm.selectedNode.riskCategory}}<div>\n                  <div>Links</div>\n                  <ul>\n                    <li ng-repeat=\"child in vm.selectedNode.children\">{{child.n}}</li>\n                  </ul>\n                </div>\n                ")($scope));
                api.elements.tooltip.stop(1, 1);
                api.show(eventArgs.target);
            });
            // sigma.plugins.dragNodes(s, s.renderers[0]);
            s.settings({
                hideEdgesOnMove: true,
                minNodeSize: 0,
                maxNodeSize: 0,
                minEdgeSize: 0,
                maxEdgeSize: 0,
                zoomMax: 100,
                zoomMin: 0.00001
            });
        }
        vm.toggle = function () {
            vm.toggled = !vm.toggled;
            $timeout(resizeCanvas, 1000);
        };
        function killAll() {
            if (s) {
                vm.started = undefined;
                s.kill();
                s = undefined;
            }
        }
        sigma['webgl'].nodes.square = angular.extend({}, sigma['webgl'].nodes.def, {
            initProgram: function (gl) {
                var vertexShader, fragmentShader, program;
                vertexShader = sigma['utils'].loadShader(gl, [
                    'attribute vec2 a_position;',
                    'attribute float a_size;',
                    'attribute float a_color;',
                    'attribute float a_angle;',
                    'uniform vec2 u_resolution;',
                    'uniform float u_ratio;',
                    'uniform float u_scale;',
                    'uniform mat3 u_matrix;',
                    'varying vec4 color;',
                    'varying vec2 center;',
                    'varying float radius;',
                    'void main() {',
                    // Multiply the point size twice:
                    'radius = a_size * u_ratio;',
                    // Scale from [[-1 1] [-1 1]] to the container:
                    'vec2 position = (u_matrix * vec3(a_position, 1)).xy;',
                    // 'center = (position / u_resolution * 2.0 - 1.0) * vec2(1, -1);',
                    'center = position * u_scale;',
                    'center = vec2(center.x, u_scale * u_resolution.y - center.y);',
                    'position = position +',
                    '4.0 * radius * vec2(cos(a_angle), sin(a_angle));',
                    'position = (position / u_resolution * 2.0 - 1.0) * vec2(1, -1);',
                    'radius = radius * u_scale;',
                    'gl_Position = vec4(position, 0, 1);',
                    // Extract the color:
                    'float c = a_color;',
                    'color.b = mod(c, 256.0); c = floor(c / 256.0);',
                    'color.g = mod(c, 256.0); c = floor(c / 256.0);',
                    'color.r = mod(c, 256.0); c = floor(c / 256.0); color /= 255.0;',
                    'color.a = 1.0;',
                    '}'
                ].join('\n'), gl.VERTEX_SHADER);
                fragmentShader = sigma['utils'].loadShader(gl, [
                    'precision mediump float;',
                    'varying vec4 color;',
                    'varying vec2 center;',
                    'varying float radius;',
                    'void main(void) {',
                    'vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);',
                    'vec2 m = gl_FragCoord.xy - center;',
                    // Here is how we draw a disc instead of a square:
                    'if (m.x < radius && m.x > -radius && m.y < radius && m.y > -radius)',
                    'gl_FragColor = color;',
                    'else',
                    'gl_FragColor = color0;',
                    '}'
                ].join('\n'), gl.FRAGMENT_SHADER);
                program = sigma['utils'].loadProgram(gl, [vertexShader, fragmentShader]);
                return program;
            }
        });
        var drawSquare = function (context, node, prefix, ratio) {
            if (ratio === void 0) { ratio = 1; }
            var size = node[prefix + 'size'];
            context.rect(node[prefix + 'x'] - ratio * size, node[prefix + 'y'] - ratio * size, size * 2 * ratio, size * 2 * ratio);
        };
        sigma.canvas.nodes.square = function (node, context, settings) {
            var prefix = (settings && settings('prefix')) || '', size = node[prefix + 'size'];
            assignNodeColor(node);
            context.fillStyle = node.color;
            context.beginPath();
            drawSquare(context, node, prefix);
            context.closePath();
            context.fill();
        };
    }
})();
//# sourceMappingURL=dashboard.component.js.map