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
    var NodeProperty;
    (function (NodeProperty) {
        NodeProperty[NodeProperty["Created"] = 0] = "Created";
        NodeProperty[NodeProperty["Modified"] = 1] = "Modified";
        NodeProperty[NodeProperty["Risk"] = 2] = "Risk";
        NodeProperty[NodeProperty["Links"] = 3] = "Links";
        NodeProperty[NodeProperty["Descendands"] = 4] = "Descendands";
        NodeProperty[NodeProperty["Exists"] = 5] = "Exists";
    })(NodeProperty || (NodeProperty = {}));
    var PropertyType;
    (function (PropertyType) {
        PropertyType[PropertyType["Number"] = 0] = "Number";
        PropertyType[PropertyType["Date"] = 1] = "Date";
        PropertyType[PropertyType["Boolean"] = 2] = "Boolean";
    })(PropertyType || (PropertyType = {}));
    var ViewType;
    (function (ViewType) {
        ViewType[ViewType["Risk"] = 0] = "Risk";
        ViewType[ViewType["Age"] = 1] = "Age";
        ViewType[ViewType["Size"] = 2] = "Size";
    })(ViewType || (ViewType = {}));
    var FilterType;
    (function (FilterType) {
        FilterType["Spreadsheets"] = "Spreadsheets";
        FilterType["Databases"] = "Databases";
    })(FilterType || (FilterType = {}));
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
        vm.nodeProperties = _.map(_.filter(NodeProperty, function (prop) { return angular.isNumber(prop); }), function (prop) { return prop; });
        vm.viewTypes = _.map(_.filter(ViewType, function (prop) { return angular.isNumber(prop); }), function (prop) { return prop; });
        vm.nodePropertiesEnum = NodeProperty;
        vm.viewTypesEnum = ViewType;
        vm.view = ViewType.Risk;
        vm.propertyTypesEnum = PropertyType;
        vm.propertyTypes = [];
        vm.propertyTypes[NodeProperty.Created] = 'Date';
        vm.propertyTypes[NodeProperty.Modified] = 'Date';
        vm.propertyTypes[NodeProperty.Descendands] = 'Number';
        vm.propertyTypes[NodeProperty.Links] = 'Number';
        vm.propertyTypes[NodeProperty.Risk] = 'Number';
        vm.propertyTypes[NodeProperty.Exists] = 'Boolean';
        vm.currentLayout = 'tree';
        vm.maxNodes = 500;
        var dataset, dict, s, ndx, typeDimension;
        var maxExpandedLevel;
        var levelCounters = [];
        var sizeCounters = [];
        var totalCount = 0;
        var startingLevel = 1;
        $scope.$watch(function () { return [vm.filters, vm.view]; }, function () { return s && refreshGraph(); }, true);
        var refreshGraph = function () {
            s.refresh();
            s.refresh();
        };
        // get exported json from cytoscape desktop via ajax
        var graphP = function () { return $.ajax({
            url: '../../data/example.json?_=' + new Date().getTime(),
            //url: '../../data/example-3276.json?_=' + new Date().getTime(), // wine-and-cheese.json
            // url: './data.json',
            type: 'GET',
            dataType: 'json'
        }); };
        // also get style via ajax
        var styleP = $.ajax({
            url: 'http://www.wineandcheesemap.com/style.cycss',
            type: 'GET',
            dataType: 'text'
        });
        var doesNodeAlreadyExist = function (id) { return !!s.graph.nodes(id); };
        var drawNodesStartingAtRoot = function (root, convertedData, ommitStartingEdge) {
            var nodeAlreadyExists = doesNodeAlreadyExist(root.n);
            if (!nodeAlreadyExists) {
                var nodeToAdd = addCyDataToQueue(convertedData, root.n, root.parentName, 'child', undefined, undefined, undefined, ommitStartingEdge);
            }
            if (root.level != maxExpandedLevel && root.c.length)
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
        var getMaxExpandedLevel = function () {
            var s = 0;
            var j;
            for (var i = 0; i < levelCounters.length; i++) {
                var levelCount = levelCounters[i] ? levelCounters[i] : 0;
                s += levelCount;
                if (s < vm.maxNodes)
                    j = i;
                else
                    break;
            }
            return j;
        };
        var drawUpwards = function (root) {
            var first = root;
            var convertedData = { nodes: [], edges: [] };
            var childName;
            var initialSize = getSize(root);
            var A = Math.max(sizeCounters[maxExpandedLevel] / 5, 2 * initialSize);
            var x = -A;
            while (root.parentName) {
                root = dict[root.parentName];
                addCyDataToQueue(convertedData, childName, root.n, 'parent', first.y, x, initialSize, true);
                x -= A;
                childName = root.n;
            }
            s.graph.read(convertedData);
            s.refresh();
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
            populateLevelCounts(root);
            maxExpandedLevel = getMaxExpandedLevel();
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
                s.refresh();
            });
        };
        var filterChangeCallback = function () {
            vm.filteredNodesCount = typeDimension.top(Infinity).length;
            if (!$scope.$$phase && !$scope.$root.$$phase)
                $scope.$apply();
            refreshGraph();
        };
        // when both graph export json and style loaded, init cy
        vm.refreshAll = function (id) { return $q.all([graphP(), styleP]).then(function (data) {
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
            if (self.level == maxExpandedLevel) {
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
                    for (var j = self.level; j < maxExpandedLevel + 1; j++) {
                        sizeCounters[self.level] += self.size + 10;
                    }
                    self.y = sizeCounters[self.level] - self.size / 2;
                }
            }
            return self.y;
        };
        var assignNodeColor = function (node) {
            if (vm.view == ViewType.Risk) {
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
            }
            else {
                node.color = '#000';
            }
            if (!_.some(typeDimension.top(Infinity), function (filteredNode) { return filteredNode.id == node.id; })) {
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
            if (datasetNode.level < maxExpandedLevel && datasetNode.level >= startingLevel)
                cyNode.data.expandable = true;
            convertedData.nodes.push(cyNode.data);
            vm.nodesCount++;
            if (datasetNode.t == FileType.Databases)
                vm.databasesCount++;
            else
                vm.spreadsheetsCount++;
            if (parent && child && !edgeExists(parentName, childName)) {
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
            cyNode.data['mass'] = size;
            cyNode.data['type'] = 'customShape';
            cyNode.data['descendants'] = datasetNode.count;
            cyNode.data['links'] = datasetNode.c.length;
            cyNode.data['filetype'] = datasetNode.t;
            cyNode.data['riskCategory'] = datasetNode.rc;
            cyNode.data['modified'] = new Date(datasetNode.md);
            cyNode.data['exists'] = datasetNode.e;
            if (vm.currentLayout == 'tree') {
                var base = 1.1;
                var A = sizeCounters[maxExpandedLevel] / 5;
                var newMaxExpandedLevel = maxExpandedLevel - startingLevel + 1;
                var newLevel = datasetNode.level - startingLevel + 1;
                var X = A / (Math.pow(base, newMaxExpandedLevel - 1) - 1);
                cyNode.position = {
                    x: y !== undefined ? y : datasetNode.y,
                    y: x !== undefined ? x : Math.pow(base, newMaxExpandedLevel - newLevel) * X * (Math.pow(base, newLevel - 1) - 1)
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
            var styleJson = then[1];
            dict = {};
            createLibraryData(dataset, null, null, '');
            killAll();
            var element = $element.find('.canvas')[0];
            sigma.canvas.edges.def = function (edge, source, target, context, settings) {
                var color = edge.color, prefix = settings('prefix') || '', size = edge[prefix + 'size'] || 1, edgeColor = settings('edgeColor'), defaultNodeColor = settings('defaultNodeColor'), defaultEdgeColor = settings('defaultEdgeColor');
                if (!color)
                    switch (edgeColor) {
                        case 'source':
                            color = source.color || defaultNodeColor;
                            break;
                        case 'target':
                            color = target.color || defaultNodeColor;
                            break;
                        default:
                            color = defaultEdgeColor;
                            break;
                    }
                context.strokeStyle = color;
                context.lineWidth = size;
                context.beginPath();
                context.moveTo(source[prefix + 'x'], source[prefix + 'y']);
                context.lineTo(target[prefix + 'x'], target[prefix + 'y']);
                context.stroke();
            };
            sigma.canvas.nodes.customShape = function (node, context, settings) {
                var prefix = (settings && settings('prefix')) || '', size = node[prefix + 'size'], shape = (node.filetype == FileType.Databases ? 'square' : 'circle'), halo, haloColor;
                assignNodeColor(node);
                context.fillStyle = node.color;
                context.beginPath();
                if (shape == 'circle') {
                    drawCircle(context, node, prefix);
                }
                else
                    drawSquare(context, node, prefix);
                context.closePath();
                context.fill();
                if (halo) {
                    var previousCompositeOperation = context.globalCompositeOperation;
                    context.globalCompositeOperation = 'destination-over';
                    context.fillStyle = haloColor ? haloColor : '#fff';
                    context.beginPath();
                    if (shape == 'circle')
                        drawCircle(context, node, prefix, 2);
                    else
                        drawSquare(context, node, prefix, 2);
                    context.closePath();
                    context.fill();
                    context.globalCompositeOperation = previousCompositeOperation;
                }
            };
            s = new sigma({
                renderers: [
                    {
                        settings: {
                            edgeColor: 'target',
                            hideEdgesOnMove: true
                        },
                        container: element,
                        type: 'canvas' // sigma.renderers.canvas works as well
                    }
                ]
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
                api.set('content.text', $compile("<div><button class=\"btn-sm btn-default\" ng-click=\"vm.refreshAll('" + eventArgs.data.node.id + "')\">Start from Here</button></div>")($scope));
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
                zoomMax: 10,
                zoomMin: 0.0001
            });
        }
        var drawCircle = function (context, node, prefix, ratio) {
            if (ratio === void 0) { ratio = 1; }
            context.arc(node[prefix + 'x'], node[prefix + 'y'], ratio * node[prefix + 'size'], 0, Math.PI * 2, true);
        };
        var drawSquare = function (context, node, prefix, ratio) {
            if (ratio === void 0) { ratio = 1; }
            var size = node[prefix + 'size'];
            context.rect(node[prefix + 'x'] - ratio * size, node[prefix + 'y'] - ratio * size, size * 2 * ratio, size * 2 * ratio);
        };
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
    }
})();
//# sourceMappingURL=dashboard.component.js.map