/// <reference path="../../node_modules/@types/angular/index.d.ts" />
/// <reference path="../../node_modules/@types/cytoscape/index.d.ts" />
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
    DashboardController.$inject = ['$element', '$scope', '$q', '$timeout', '$window'];
    function DashboardController($element, $scope, $q, $timeout, $window) {
        var vm = this;
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
        vm.filters = {};
        vm.getFiltersActive = function () { return _.some(vm.filters, function (filter) { return filter !== undefined; }); };
        vm.getFilterActive = function (filter) { return !!vm.filters[FilterType[filter]]; };
        vm.toggleFilter = function (filter) { return vm.filters[FilterType[filter]] = !vm.filters[FilterType[filter]]; };
        vm.resetFilters = function () { return _.each(_.keys(vm.filters), function (key) { return vm.filters[key] = undefined; }); };
        vm.currentLayout = 'tree';
        vm.maxNodes = 500;
        var dataset, dict, s;
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
            if (vm.currentLayout == 'fractal') {
                vm.start();
            }
            $timeout(function () {
                resizeCanvas();
                s.refresh();
            });
        };
        // when both graph export json and style loaded, init cy
        var refreshAll = function () { return $q.all([graphP(), styleP]).then(function (data) {
            initCy(data);
            drawNodes(dataset.n);
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
            if (vm.getFiltersActive()) {
                var tempColor = '#bbb';
                if (vm.filters[FilterType.Databases] && node.filetype == FileType.Databases) {
                    tempColor = node.color;
                }
                if (vm.filters[FilterType.Spreadsheets] && node.filetype == FileType.Spreadsheets) {
                    tempColor = node.color;
                }
                node.color = tempColor;
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
            cyNode.data['label'] = 'XLSX';
            cyNode.data['type'] = 'customShape';
            cyNode.data['descendants'] = datasetNode.count;
            cyNode.data['links'] = datasetNode.c.length;
            cyNode.data['filetype'] = datasetNode.t;
            cyNode.data['riskCategory'] = datasetNode.rc;
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
            refreshAll();
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
                        },
                        container: element,
                        type: 'canvas' // sigma.renderers.canvas works as well
                    }
                ]
            });
            sigma.plugins.dragNodes(s, s.renderers[0]);
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