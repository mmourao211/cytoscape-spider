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
    var RuleOperator;
    (function (RuleOperator) {
        RuleOperator[RuleOperator["Equals"] = 0] = "Equals";
        RuleOperator[RuleOperator["NotEquals"] = 1] = "NotEquals";
        RuleOperator[RuleOperator["LessThan"] = 2] = "LessThan";
        RuleOperator[RuleOperator["GreaterThan"] = 3] = "GreaterThan";
        RuleOperator[RuleOperator["Yes"] = 4] = "Yes";
        RuleOperator[RuleOperator["No"] = 5] = "No";
    })(RuleOperator || (RuleOperator = {}));
    DashboardController.$inject = ['$element', '$scope', '$q', '$timeout', '$window'];
    function DashboardController($element, $scope, $q, $timeout, $window) {
        var vm = this;
        vm.nodeProperties = _.map(_.filter(NodeProperty, function (prop) { return angular.isNumber(prop); }), function (prop) { return prop; });
        vm.nodePropertiesEnum = NodeProperty;
        vm.ruleOperatorsEnum = RuleOperator;
        vm.propertyTypesEnum = PropertyType;
        vm.ruleOperators = [];
        vm.ruleOperators[NodeProperty.Created] = [RuleOperator.Equals, RuleOperator.NotEquals, RuleOperator.GreaterThan, RuleOperator.LessThan];
        vm.ruleOperators[NodeProperty.Modified] = [RuleOperator.Equals, RuleOperator.NotEquals, RuleOperator.GreaterThan, RuleOperator.LessThan];
        vm.ruleOperators[NodeProperty.Risk] = [RuleOperator.Equals, RuleOperator.NotEquals, RuleOperator.GreaterThan, RuleOperator.LessThan];
        vm.ruleOperators[NodeProperty.Links] = [RuleOperator.Equals, RuleOperator.NotEquals, RuleOperator.GreaterThan, RuleOperator.LessThan];
        vm.ruleOperators[NodeProperty.Descendands] = [RuleOperator.Equals, RuleOperator.NotEquals, RuleOperator.GreaterThan, RuleOperator.LessThan];
        vm.ruleOperators[NodeProperty.Exists] = [RuleOperator.Yes, RuleOperator.No];
        vm.propertyTypes = [];
        vm.propertyTypes[NodeProperty.Created] = 'Date';
        vm.propertyTypes[NodeProperty.Modified] = 'Date';
        vm.propertyTypes[NodeProperty.Descendands] = 'Number';
        vm.propertyTypes[NodeProperty.Links] = 'Number';
        vm.propertyTypes[NodeProperty.Risk] = 'Number';
        vm.propertyTypes[NodeProperty.Exists] = 'Boolean';
        vm.removeRule = function (index) { return _.pullAt(vm.style.rules, [index]); };
        vm.ruleUp = function (index) {
            var temp = vm.style.rules[index];
            vm.style.rules[index] = vm.style.rules[index - 1];
            vm.style.rules[index - 1] = temp;
        };
        vm.ruleDown = function (index) {
            var temp = vm.style.rules[index];
            vm.style.rules[index] = vm.style.rules[index + 1];
            vm.style.rules[index + 1] = temp;
        };
        vm.currentLayout = 'tree';
        vm.maxNodes = 500;
        vm.style = {
            nodeColor: '#000000',
            edgeColor: '#000000',
            backgroundColor: '#ffffff',
            rules: []
        };
        $element.find('.background-color-picker')[0]['value'] = vm.style.backgroundColor;
        $element.find('.node-color-picker')[0]['value'] = vm.style.nodeColor;
        $element.find('.edge-color-picker')[0]['value'] = vm.style.edgeColor;
        $scope.$watch(function () { return vm.style; }, function () { return s && s.refresh(); }, true);
        var dataset, dict, s;
        var maxExpandedLevel;
        var levelCounters = [];
        var sizeCounters = [];
        var totalCount = 0;
        var startingLevel = 1;
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
            drawNodesStartingAtRoot(root, convertedData, true);
            s.graph.read(convertedData);
            if (vm.currentLayout == 'fractal') {
                vm.start();
            }
            s.refresh();
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
            if (parent && child && !edgeExists(parentName, childName)) {
                var edge = {
                    data: {
                        id: getEdgeId(parentName, childName),
                        source: parent.n,
                        target: child.n,
                        size: ommitEdge ? 10 : getSize(child) / 4,
                        weight: ommitEdge ? 10 : getSize(child) / 4,
                        type: 'customShape'
                    }
                };
                convertedData.edges.push(edge.data);
            }
            cyNode.data['size'] = size;
            cyNode.data['mass'] = size;
            cyNode.data['label'] = 'XLSX';
            cyNode.data['color'] = '#ccc';
            cyNode.data['type'] = 'customShape';
            cyNode.data['descendants'] = datasetNode.count;
            cyNode.data['links'] = datasetNode.c.length;
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
        function getRandomColor() {
            var letters = '0123456789ABCDEF';
            var color = '#';
            for (var i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }
        var resizeCanvas = function () {
            var canvas = $element.find('.canvas');
            var container = $element.find('.canvas-container');
            canvas.height(container.height());
            canvas.width(container.width());
        };
        $($window).resize(resizeCanvas);
        $timeout(resizeCanvas);
        var evaluateRule = function (toCompare, operator, value) {
            switch (operator) {
                case RuleOperator.Equals:
                    return toCompare == value;
                case RuleOperator.GreaterThan:
                    return toCompare > value;
                case RuleOperator.LessThan:
                    return toCompare < value;
                case RuleOperator.NotEquals:
                    return toCompare != value;
            }
        };
        function initCy(then) {
            dataset = then[0];
            var styleJson = then[1];
            dict = {};
            createLibraryData(dataset, null, null, '');
            killAll();
            var element = $element.find('.canvas')[0];
            sigma.canvas.edges.customShape = function (edge, source, target, context, settings) {
                var color, prefix = settings('prefix') || '', size = edge[prefix + 'size'] || 1, edgeColor = settings('edgeColor'), defaultNodeColor = settings('defaultNodeColor'), defaultEdgeColor = settings('defaultEdgeColor');
                color = vm.style.edgeColor;
                context.strokeStyle = color;
                context.lineWidth = size;
                context.beginPath();
                context.moveTo(source[prefix + 'x'], source[prefix + 'y']);
                context.lineTo(target[prefix + 'x'], target[prefix + 'y']);
                context.stroke();
            };
            sigma.canvas.nodes.customShape = function (node, context, settings) {
                var prefix = (settings && settings('prefix')) || '', size = node[prefix + 'size'], shape = 'circle', halo, haloColor;
                context.fillStyle = vm.style.nodeColor;
                for (var i = vm.style.rules.length - 1; i >= 0; i--) {
                    var rule = vm.style.rules[i];
                    switch (rule.property) {
                        case NodeProperty.Links:
                            if (evaluateRule(node['links'], rule.operator, rule.numericValue)) {
                                if (rule.changeColor)
                                    context.fillStyle = rule.color;
                                if (rule.changeShape)
                                    shape = rule.square ? 'square' : 'circle';
                                if (rule.halo) {
                                    halo = true;
                                    haloColor = rule.haloColor;
                                }
                            }
                            break;
                        case NodeProperty.Descendands:
                            if (evaluateRule(node['descendants'], rule.operator, rule.numericValue)) {
                                if (rule.changeColor)
                                    context.fillStyle = rule.color;
                                if (rule.changeShape)
                                    shape = rule.square ? 'square' : 'circle';
                                if (rule.halo) {
                                    halo = true;
                                    haloColor = rule.haloColor;
                                }
                            }
                            break;
                    }
                }
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