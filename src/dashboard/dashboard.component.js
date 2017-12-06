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
        var drawNodesStartingAtRoot = function (root, layoutType, convertedData, maxExpandedLevel) {
            if (cy.$id(root.name).length == 0) {
                var node = {
                    data: {
                        id: root.name,
                        ancestors: root.ancestorList
                    },
                    position: null,
                    style: null
                };
                convertedData.push(node);
                if (root.parentName)
                    convertedData.push({
                        data: {
                            id: root.parentName + " to " + root.name,
                            source: root.parentName,
                            target: root.name
                        },
                        style: {
                            width: layoutType == 'tree' ? 64 / Math.pow(root.level, 1.7) : 3 / root.level,
                        }
                    });
                if (layoutType == 'tree') {
                    node.position = {
                        y: 30 * root.y,
                        x: 7000 * Math.log(root.level)
                    };
                    node.style = {
                        'content': 'XLSX',
                        'text-valign': 'center',
                        'color': 'white',
                        'font-size': (8 * Math.pow(root.size, 1.7)).toString() + 'px',
                        'text-outline-color': '#888',
                        'background-color': '#888',
                        width: 16 * Math.pow(root.size, 1.7),
                        height: 16 * Math.pow(root.size, 1.7)
                    };
                }
                else if (layoutType == 'fractal') {
                    node.position = {
                        x: root.x,
                        y: root.y
                    };
                    node.style = {
                        'content': 'XLSX',
                        'text-valign': 'center',
                        'color': 'white',
                        'font-size': (8 * Math.pow(maxLevel - root.level + 1, 1.7)).toString() + 'px',
                        'text-outline-color': '#888',
                        'background-color': '#888',
                        width: 16 * Math.pow(maxLevel - root.level + 1, 1.7),
                        height: 16 * Math.pow(maxLevel - root.level + 1, 1.7),
                    };
                }
            }
            if (root.level == maxExpandedLevel && root.children.length) {
                node.style.shape = 'rectangle';
                node.style.content = '+' + root.count;
            }
            else if (root.children.length)
                for (var i = 0; i < root.children.length; i++) {
                    drawNodesStartingAtRoot(root.children[i], layoutType, convertedData, maxExpandedLevel);
                }
        };
        var populateLevelCounts = function (root, levelCounts) {
            if (!levelCounts[root.level])
                levelCounts[root.level] = 0;
            levelCounts[root.level]++;
            if (root.children.length)
                for (var i = 0; i < root.children.length; i++)
                    populateLevelCounts(root.children[i], levelCounts);
        };
        var getMaxExpandedLevel = function (levelCounts) {
            var s = 0;
            var j;
            for (var i = 0; i < levelCounts.length; i++) {
                var levelCount = levelCounts[i] ? levelCounts[i] : 0;
                s += levelCount;
                if (s < 500)
                    j = i + 1;
                else
                    break;
            }
            return j;
        };
        var drawUpwards = function (root, layoutType) {
            var convertedData = [];
            while (root.parentName) {
                root = dict[root.parentName];
                var node = {
                    data: {
                        id: root.name,
                        ancestors: root.ancestorList
                    },
                    position: null,
                    style: null
                };
                convertedData.push(node);
                if (layoutType == 'tree') {
                    node.position = {
                        y: 30 * root.y,
                        x: 7000 * Math.log(root.level)
                    };
                    node.style = {
                        'content': 'XLSX',
                        'text-valign': 'center',
                        'color': 'white',
                        'font-size': (8 * Math.pow(root.size, 1.7)).toString() + 'px',
                        'text-outline-color': '#888',
                        'background-color': '#888',
                        width: 16 * Math.pow(root.size, 1.7),
                        height: 16 * Math.pow(root.size, 1.7)
                    };
                }
                else if (layoutType == 'fractal') {
                    node.position = {
                        x: root.x,
                        y: root.y
                    };
                    node.style = {
                        'content': 'XLSX',
                        'text-valign': 'center',
                        'color': 'white',
                        'font-size': (8 * Math.pow(maxLevel - root.level + 1, 1.7)).toString() + 'px',
                        'text-outline-color': '#888',
                        'background-color': '#888',
                        width: 16 * Math.pow(maxLevel - root.level + 1, 1.7),
                        height: 16 * Math.pow(maxLevel - root.level + 1, 1.7),
                    };
                }
            }
            cy.add(convertedData);
        };
        var drawNodes = function (id, layoutType) {
            var root = dict[id];
            var convertedData = [];
            var levelCounts = [];
            populateLevelCounts(root, levelCounts);
            var maxExpandedLevel = getMaxExpandedLevel(levelCounts);
            drawUpwards(root, layoutType);
            drawNodesStartingAtRoot(root, layoutType, convertedData, maxExpandedLevel);
            cy.add(convertedData);
        };
        // when both graph export json and style loaded, init cy
        var refreshAll = function (layoutType) { return $q.all([graphP(), styleP]).then(function (data) {
            initCy(data, layoutType);
            drawNodes(dataset.name, layoutType);
            cy.fit(cy.$id(dataset.name), 200);
        }); };
        var allNodes = null;
        var allEles = null;
        var lastHighlighted = null;
        var lastUnhighlighted = null;
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
        var levelCounters = [];
        var maxLevel = 8;
        var getFractalPosition = function (self, R, oldTheta) {
            if (!self.children.length)
                return;
            if (!R)
                R = 5000;
            if (!oldTheta)
                oldTheta = Math.PI;
            var n = self.children.length;
            var theta = 2 * Math.PI / n;
            var newR = R * Math.sin(6 * oldTheta / 20);
            for (var k = 0; k < n; k++) {
                var child = self.children[k];
                child.x = self.x + newR * Math.cos(theta * k);
                child.y = self.y + newR * Math.sin(theta * k);
                getFractalPosition(child, newR, theta);
            }
        };
        var getY = function (self, level, levelCounters) {
            if (!levelCounters[level])
                levelCounters[level] = 0;
            self.size = 12 * (1 - level / (maxLevel + 1));
            var children = self.children;
            if (!children.length) {
                for (var i = level; i < maxLevel + 1; i++) {
                    if (!levelCounters[i])
                        levelCounters[i] = 0;
                    levelCounters[i] += 1;
                }
                self.y = levelCounters[level];
                return self.y;
            }
            else {
                var first, last;
                for (var j = 0; j < children.length; j++) {
                    var child = children[j];
                    if (!child.y)
                        child.y = getY(child, level + 1, levelCounters);
                    if (j == 0)
                        first = child.y;
                    if (j == children.length - 1)
                        last = child.y;
                }
                levelCounters[level] = last;
                return (first + last) / 2;
            }
        };
        var getChildrenCount = function (parent) {
            if (!parent.count)
                parent.count = _.sumBy(parent.children, function (child) { return getChildrenCount(child); }) + 1;
            return parent.count;
        };
        var createCyData = function (root, parentName, level, layoutType, ancestorList) {
            if (!level)
                level = 1;
            dict[root.name] = root;
            root.count = getChildrenCount(root);
            root.level = level;
            root.ancestorList = ancestorList;
            root.parentName = parentName;
            _.each(root.children, function (child) { return createCyData(child, root.name, level + 1, layoutType, ancestorList + (" -" + root.name + "- ")); });
            if (layoutType == 'tree') {
                root.x = root.x ? root.x : 7000 * Math.log(level);
                root.y = root.y ? root.y : getY(root, level, levelCounters);
            }
            else if (layoutType == 'fractal') {
            }
        };
        vm.draw = function (layoutType) {
            refreshAll(layoutType);
        };
        function initCy(then, layoutType) {
            var loading = document.getElementById('loading');
            dataset = then[0];
            var styleJson = then[1];
            var elements = [];
            if (!layoutType)
                layoutType = 'fractal';
            if (layoutType == 'fractal') {
                dataset.x = 0;
                dataset.y = 0;
                getFractalPosition(dataset, 0);
            }
            else if (layoutType == 'tree') {
                levelCounters = [];
            }
            dict = {};
            createCyData(dataset, null, null, layoutType, '');
            cy = window.cy = cytoscape({
                container: $element.find('.container')[0],
                layout: {
                    name: 'preset',
                    boundingBox: { x1: 0, y1: 0, x2: 1000000, y2: 100000 }
                },
                motionBlur: true,
                selectionType: 'single',
                boxSelectionEnabled: false,
                autoungrabify: true,
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
                        selector: 'node',
                        onClickFunction: function (event) {
                            var target = event.target || event.cyTarget;
                            cy.remove(cy.$("[ancestors *= \"-" + target.id() + "-\"]"));
                            target.style('shape', 'rectangle');
                            target.style('content', '+' + getChildrenCount(dict[target.id()]));
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
                            drawNodes(id, layoutType);
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