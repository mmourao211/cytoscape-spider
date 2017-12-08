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
    DashboardController.$inject = ['$element', '$q', '$timeout'];
    function DashboardController($element, $q, $timeout) {
        var vm = this;
        var layoutPadding = 50;
        var aniDur = 500;
        var easing = 'linear';
        var cy, dataset, dict;
        var maxExpandedLevel;
        var currentLayout;
        var levelCounters = [];
        var sizeCounters = [];
        var maxLevel = 8;
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
        var drawNodesStartingAtRoot = function (root, convertedData, ommitStartingEdge) {
            var nodeAlreadyExists = cy.$id(root.n).length != 0;
            if (!nodeAlreadyExists) {
                var nodeToAdd = addCyDataToQueue(convertedData, root.n, root.parentName, 'child', undefined, undefined, undefined, ommitStartingEdge);
                if (root.level == maxExpandedLevel && root.c.length) {
                    nodeToAdd.style.shape = 'rectangle';
                    nodeToAdd.style.content = '+' + root.count;
                }
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
                if (s < 500)
                    j = i;
                else
                    break;
            }
            return j;
        };
        var drawUpwards = function (root) {
            var first = root;
            var convertedData = [];
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
            cy.add(convertedData);
        };
        var drawNodes = function (id) {
            var root = dict[id];
            var convertedData = [];
            levelCounters = [];
            sizeCounters = [];
            totalCount = 0;
            startingLevel = root.level;
            populateLevelCounts(root);
            maxExpandedLevel = getMaxExpandedLevel();
            getY(root);
            drawUpwards(root);
            drawNodesStartingAtRoot(root, convertedData, true);
            cy.add(convertedData);
            cy.fit(cy.nodes());
        };
        // when both graph export json and style loaded, init cy
        var refreshAll = function (layoutType) { return $q.all([graphP(), styleP]).then(function (data) {
            currentLayout = layoutType;
            initCy(data);
            drawNodes(dataset.n);
            // cy.fit(cy.$id(dataset.n), 200);
        }); };
        var allNodes = null;
        var allEles = null;
        var lastHighlighted = null;
        var lastUnhighlighted = null;
        var getEdgeId = function (parentName, childName) { return parentName + " to " + childName; };
        var edgeExists = function (parentName, childName) { return !!cy.$id(getEdgeId(parentName, childName)).length; };
        var getSize = function (node) { return 10000 * node.level * Math.sqrt(node.count / (2 * Math.PI * totalCount)); };
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
            convertedData.push(cyNode);
            if (parent && child && !edgeExists(parentName, childName)) {
                var edge = {
                    data: {
                        id: getEdgeId(parentName, childName),
                        source: parent.n,
                        target: child.n
                    },
                    style: {
                        width: ommitEdge ? 10 : getSize(child) / 4,
                        'line-color': ommitEdge ? '#ccc' : '#888',
                        'curve-style': 'bezier'
                    }
                };
                convertedData.push(edge);
                if (ommitEdge) {
                    edge.style['mid-target-arrow-color'] = '#ccc';
                    edge.style['mid-target-arrow-shape'] = 'triangle';
                    edge.style['arrow-scale'] = 100;
                }
                else {
                    edge.style['mid-target-arrow-shape'] = 'triangle';
                    edge.style['arrow-scale'] = 2;
                }
            }
            if (currentLayout == 'tree') {
                var base = 1.1;
                var A = sizeCounters[maxExpandedLevel] / 5;
                var newMaxExpandedLevel = maxExpandedLevel - startingLevel + 1;
                var newLevel = datasetNode.level - startingLevel + 1;
                var X = A / (Math.pow(base, newMaxExpandedLevel - 1) - 1);
                cyNode.position = {
                    x: y !== undefined ? y : datasetNode.y,
                    y: x !== undefined ? x : Math.pow(base, newMaxExpandedLevel - newLevel) * X * (Math.pow(base, newLevel - 1) - 1)
                };
                cyNode.style = {
                    'content': 'XLSX',
                    'text-valign': 'center',
                    'color': 'white',
                    'font-size': (size / 3).toString() + 'px',
                    'text-outline-color': whatToAdd == 'parent' ? '#ccc' : '#888',
                    'background-color': whatToAdd == 'parent' ? '#ccc' : '#888',
                    width: size,
                    height: size
                };
            }
            else if (currentLayout == 'fractal') {
                cyNode.position = {
                    x: datasetNode.x,
                    y: datasetNode.y
                };
                cyNode.style = {
                    'content': 'XLSX',
                    'text-valign': 'center',
                    'color': 'white',
                    'font-size': (8 * Math.pow(maxLevel - datasetNode.level + 1, 1.7)).toString() + 'px',
                    'text-outline-color': '#888',
                    'background-color': '#888',
                    width: 16 * Math.pow(maxLevel - datasetNode.level + 1, 1.7),
                    height: 16 * Math.pow(maxLevel - datasetNode.level + 1, 1.7),
                };
            }
            return cyNode;
        };
        function getFadePromise(ele, opacity) {
            return ele.animation({
                style: { 'opacity': opacity },
                duration: aniDur
            }).play().promise();
        }
        ;
        var restoreElesPositions = function (nhood) {
            return $q.all(nhood.map(function (ele) {
                var p = ele.data('orgPos');
                return ele.animation({
                    position: { x: p.x, y: p.y },
                    duration: aniDur,
                    easing: easing
                }).play().promise();
            }));
        };
        function highlight(node) {
            var oldNhood = lastHighlighted;
            var nhood = lastHighlighted = node.closedNeighborhood();
            var others = lastUnhighlighted = cy.elements().not(nhood);
            var reset = function () {
                cy.batch(function () {
                    others.addClass('hidden');
                    nhood.removeClass('hidden');
                    allEles.removeClass('faded highlighted');
                    nhood.addClass('highlighted');
                    others.nodes().forEach(function (n) {
                        var p = n.data('orgPos');
                        n.position({ x: p.x, y: p.y });
                    });
                });
                return $q.resolve().then(function () {
                    if (isDirty()) {
                        return fit();
                    }
                    else {
                        return $q.resolve();
                    }
                    ;
                }).then(function () {
                    return delay(aniDur);
                });
            };
            var runLayout = function () {
                var p = node.data('orgPos');
                var l = nhood.filter(':visible').makeLayout({
                    name: 'concentric',
                    fit: false,
                    animate: true,
                    animationDuration: aniDur,
                    animationEasing: easing,
                    boundingBox: {
                        x1: p.x - 1,
                        x2: p.x + 1,
                        y1: p.y - 1,
                        y2: p.y + 1
                    },
                    avoidOverlap: true,
                    concentric: function (ele) {
                        if (ele.same(node)) {
                            return 2;
                        }
                        else {
                            return 1;
                        }
                    },
                    levelWidth: function () { return 1; },
                    padding: layoutPadding
                });
                var promise = cy.promiseOn('layoutstop');
                l.run();
                return promise;
            };
            var fit = function () {
                return cy.animation({
                    fit: {
                        eles: nhood.filter(':visible'),
                        padding: layoutPadding
                    },
                    easing: easing,
                    duration: aniDur
                }).play().promise();
            };
            var showOthersFaded = function () {
                return delay(250).then(function () {
                    cy.batch(function () {
                        others.removeClass('hidden').addClass('faded');
                    });
                });
            };
            return $q.when()
                .then(reset)
                .then(runLayout)
                .then(fit)
                .then(showOthersFaded);
        }
        function delay(duration) {
            var deferred = $q.defer();
            $timeout(function () { return deferred.resolve(); }, duration);
            return deferred.promise;
        }
        function isDirty() {
            return lastHighlighted != null;
        }
        function clear(opts) {
            if (!isDirty()) {
                return $q.when();
            }
            opts = $.extend({}, opts);
            cy.stop();
            allNodes.stop();
            var nhood = lastHighlighted;
            var others = lastUnhighlighted;
            lastHighlighted = lastUnhighlighted = null;
            var hideOthers = function () {
                return delay(125).then(function () {
                    others.addClass('hidden');
                    return delay(125);
                });
            };
            var showOthers = function () {
                cy.batch(function () {
                    allEles.removeClass('hidden').removeClass('faded');
                });
                return delay(aniDur);
            };
            var restorePositions = function () {
                cy.batch(function () {
                    others.nodes().forEach(function (n) {
                        var p = n.data('orgPos');
                        n.position({ x: p.x, y: p.y });
                    });
                });
                return restoreElesPositions(nhood.nodes());
            };
            var resetHighlight = function () {
                nhood.removeClass('highlighted');
            };
            return $q.when()
                .then(resetHighlight)
                .then(hideOthers)
                .then(restorePositions)
                .then(showOthers);
        }
        // function showNodeInfo( node ){
        //   $('#info').html( infoTemplate( node.data() ) ).show();
        // }
        function hideNodeInfo() {
            $('#info').hide();
        }
        var getFractalPosition = function (self, R, oldTheta) {
            if (!self.c.length)
                return;
            if (!R)
                R = 5000;
            if (!oldTheta)
                oldTheta = Math.PI;
            var n = self.c.length;
            var theta = 2 * Math.PI / n;
            var newR = R * Math.sin(6 * oldTheta / 20);
            for (var k = 0; k < n; k++) {
                var child = self.c[k];
                child.x = self.x + newR * Math.cos(theta * k);
                child.y = self.y + newR * Math.sin(theta * k);
                getFractalPosition(child, newR, theta);
            }
        };
        var getChildrenCount = function (parent) {
            if (!parent.count)
                parent.count = _.sumBy(parent.c, function (child) { return getChildrenCount(child); }) + 1;
            return parent.count;
        };
        var createCyData = function (root, parentName, level, ancestorList) {
            if (!level)
                level = 1;
            dict[root.n] = root;
            root.count = getChildrenCount(root);
            if (!parentName)
                totalCount = root.count;
            root.level = level;
            root.ancestorList = ancestorList;
            root.parentName = parentName;
            _.each(root.c, function (child) { return createCyData(child, root.n, level + 1, ancestorList + (" -" + root.n + "- ")); });
        };
        vm.draw = function (layoutType) {
            refreshAll(layoutType);
        };
        function initCy(then) {
            var loading = document.getElementById('loading');
            dataset = then[0];
            var styleJson = then[1];
            var elements = [];
            if (!currentLayout)
                currentLayout = 'fractal';
            if (currentLayout == 'fractal') {
                dataset.x = 0;
                dataset.y = 0;
                getFractalPosition(dataset, 0);
            }
            else if (currentLayout == 'tree') {
                levelCounters = [];
            }
            dict = {};
            createCyData(dataset, null, null, '');
            cy = window.cy = cytoscape({
                container: $element.find('.container')[0],
                layout: {
                    name: 'preset',
                    boundingBox: { x1: 0, y1: 0, x2: 1000000, y2: 100000 }
                },
                motionBlur: true,
                selectionType: 'single',
                boxSelectionEnabled: false,
                hideEdgesOnViewport: true,
                style: cytoscape.stylesheet()
                    .selector('node')
                    .css({
                    'text-valign': 'center',
                    'color': 'white',
                    'text-outline-width': 2,
                    'text-outline-color': '#888',
                    'background-color': '#888'
                })
            });
            var options = {
                // List of initial menu items
                menuItems: [
                    {
                        id: 'collapse',
                        content: 'Collapse',
                        tooltipText: 'Collapse',
                        selector: 'node[expandable]',
                        onClickFunction: function (event) {
                            var target = event.target || event.cyTarget;
                            cy.remove(cy.$("[ancestors *= \"-" + target.id() + "-\"]"));
                            target.style('shape', 'rectangle');
                            target.style('content', '+' + getChildrenCount(dict[target.id()]));
                        }
                    },
                    {
                        id: 'expand',
                        content: 'Expand',
                        tooltipText: 'Expand',
                        selector: 'node[expandable]',
                        onClickFunction: function (event) {
                            var target = event.target || event.cyTarget;
                            var toAdd = [];
                            drawNodesStartingAtRoot(dict[target.id()], toAdd, false);
                            cy.add(toAdd);
                            target.style('shape', 'ellipse');
                            target.style('content', 'XLSX');
                        }
                    },
                    {
                        id: 'start-from',
                        content: 'Start from here',
                        tooltipText: 'Start from here',
                        selector: 'node',
                        onClickFunction: function (event) {
                            var target = event.target || event.cyTarget;
                            var id = target.id();
                            cy.remove(cy.nodes());
                            drawNodes(id);
                        }
                    },
                    {
                        id: 'focus',
                        content: 'Focus',
                        tooltipText: 'Focus',
                        selector: 'node',
                        onClickFunction: function (event) {
                            var target = event.target || event.cyTarget;
                            cy.fit(target, 200);
                        }
                    }
                ],
                // css classes that menu items will have
                menuItemClasses: [],
                // css classes that context menu will have
                contextMenuClasses: []
            };
            cy.contextMenus(options);
        }
        var lastSearch = '';
    }
})();
//# sourceMappingURL=dashboard.component.js.map