/// <reference path="../../node_modules/@types/angular/index.d.ts" />
/// <reference path="../../node_modules/@types/cytoscape/index.d.ts" />
/// <reference path="../../node_modules/@types/lodash/index.d.ts" />
'use strict';

(() => {
  angular.module('app')
  .component('dashboard', {
    templateUrl: 'dashboard/dashboard.html',
    controller: DashboardController,
    controllerAs: 'vm'
  });

  DashboardController.$inject = ['$element', '$q', '$timeout'];

  enum Library{
    Sigma,
    Cytoscape
  }

  function DashboardController($element: JQuery, $q: angular.IQService, $timeout: angular.ITimeoutService) {
    const vm = this;
    vm.library = Library.Sigma;
    vm.currentLayout = 'tree';
    vm.libraries = Library;
    vm.maxNodes = 500;
    var cy, dataset, dict,s;
    var maxExpandedLevel;
    var levelCounters = [];
    var sizeCounters = [];
    var totalCount = 0;
    var startingLevel = 1;
  
    // get exported json from cytoscape desktop via ajax
    var graphP = () => $.ajax({
      url: '../../data/example.json?_=' + new Date().getTime(), // wine-and-cheese.json
      //url: '../../data/example-3276.json?_=' + new Date().getTime(), // wine-and-cheese.json
      // url: './data.json',
      type: 'GET',
      dataType: 'json'
    });
  
    // also get style via ajax
    var styleP = $.ajax({
      url: 'http://www.wineandcheesemap.com/style.cycss', // wine-and-cheese-style.cycss
      type: 'GET',
      dataType: 'text'
    });
  
    var doesNodeAlreadyExist = (id) => vm.library == Library.Cytoscape ? cy.$id(id).length != 0 : !!s.graph.nodes(id);
  
    var drawNodesStartingAtRoot = (root, convertedData, ommitStartingEdge) => {
      var nodeAlreadyExists = doesNodeAlreadyExist(root.n);
      if(!nodeAlreadyExists){
        var nodeToAdd = addCyDataToQueue(convertedData, root.n, root.parentName,'child', undefined, undefined, undefined, ommitStartingEdge)
        if(root.level == maxExpandedLevel && root.c.length){
          nodeToAdd.style.shape = 'rectangle';
          nodeToAdd.style.content = '+' + root.count;
        }
      }
      if(root.level != maxExpandedLevel && root.c.length)
        for(var i = 0; i < root.c.length; i++){
          drawNodesStartingAtRoot(root.c[i], convertedData, false)
        }

    }

    var populateLevelCounts = (root) => {
      if(!levelCounters[root.level]) levelCounters[root.level] = 0;
      levelCounters[root.level]++;
      if(root.c.length)
        for(var i = 0; i < root.c.length; i++)
          populateLevelCounts(root.c[i]);
        
    }

    var getMaxExpandedLevel = () => {
      var s = 0;
      var j;
      for(var i = 0; i < levelCounters.length; i++){
        var levelCount = levelCounters[i] ? levelCounters[i] : 0;
        s += levelCount;
        if(s < vm.maxNodes)
          j = i;
        else
          break; 
      }
      return j;
    }

    var drawUpwards = (root) => {
      var first = root;
      var convertedData = vm.library == Library.Cytoscape ?  [] : {nodes: [], edges: []};
      var childName;
      var initialSize = getSize(root);
      var A = Math.max(sizeCounters[maxExpandedLevel]/5, 2*initialSize);
      var x = -A;
      while(root.parentName){
        
        root = dict[root.parentName];
        addCyDataToQueue(convertedData, childName, root.n, 'parent', first.y, x, initialSize, true);
        x -= A;
        childName = root.n;
      }
      if(vm.library == Library.Cytoscape)
        cy.add(convertedData);
      else{
        s.graph.read(convertedData)
        s.refresh()
      }
    }
    vm.stop = () => {
      s.stopForceAtlas2();    
      vm.started = false;
    }
    vm.start = () => {
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
      })
    }

    var drawNodes = (id) => {
      var root = dict[id];
      var convertedData = vm.library == Library.Cytoscape ? [] : {nodes: [], edges: []};
      levelCounters = [];
      sizeCounters = [];
      totalCount = 0;
      startingLevel = root.level;
      populateLevelCounts(root);
      maxExpandedLevel = getMaxExpandedLevel();
      getY(root);
      drawUpwards(root)
      drawNodesStartingAtRoot(root, convertedData, true)
      if(vm.library == Library.Cytoscape)
        cy.add(convertedData);
      else{
        s.graph.read(convertedData)
        if(vm.currentLayout == 'fractal'){
          vm.start();
        }
        s.refresh();
      }
      if(vm.currentLayout == 'fractal')
        if(vm.library == Library.Cytoscape)
          cy.layout({
            name: 'cose', 
            randomize: true
          }).run();
      if(vm.library == Library.Cytoscape)
        cy.fit(cy.nodes());
    }
    // when both graph export json and style loaded, init cy
    var refreshAll = () => $q.all([ graphP(), styleP ]).then(data => {
      initCy(data);
      drawNodes(dataset.n);
    });
  
    var getEdgeId = (parentName, childName) => `${parentName} to ${childName}`
    var edgeExists = (parentName, childName) => vm.library == Library.Cytoscape ? !!cy.$id(getEdgeId(parentName, childName)).length : !!s.graph.edges(getEdgeId(parentName, childName))

    var getSize = (node) => (vm.library == Library.Cytoscape ?  10000 : 100) * Math.sqrt(node.count / (2*Math.PI*totalCount));
    

    var getY = (self) => {
      if(!totalCount) totalCount = self.count;
      if(!sizeCounters[self.level]) sizeCounters[self.level] = 0;
      self.size = getSize(self);
      if(self.level == maxExpandedLevel){
        sizeCounters[self.level] += self.size + 10;
        self.y = sizeCounters[self.level] - self.size / 2;
      }
      else{
        if(self.c.length){
          var first,last;
          for(var i = 0; i < self.c.length; i++){
            var child = self.c[i];
            child.y = getY(child);
            if(i == 0) first = child;
            if(i == self.c.length-1) last = child;
          }
          self.y = (first.y + last.y) / 2;
          sizeCounters[self.level] = last.y + last.size /2 + 10;
        }
        else{
          for(var j = self.level; j < maxExpandedLevel + 1;j++){
            sizeCounters[self.level] += self.size + 10;
          }
          self.y = sizeCounters[self.level] - self.size /2;
        }
      }
      return self.y;
    }
    var addCyDataToQueue = (convertedData, childName, parentName, whatToAdd, y?, x?, size?, ommitEdge?) => {
      var child = dict[childName];
      var parent = dict[parentName];
      var datasetNode = whatToAdd == 'parent' ? parent : child;
      size = size !== undefined ? size : getSize(datasetNode)
      var cyNode = {
        data: {
          id: datasetNode.n,
          ancestors: datasetNode.ancestorList
        },
        position: null,
        style: null
      };
      if(datasetNode.level < maxExpandedLevel && datasetNode.level >= startingLevel ) 
        (cyNode.data as any).expandable = true;
      if(vm.library == Library.Cytoscape)
        convertedData.push(cyNode);
      else
        convertedData.nodes.push(cyNode.data);
      if (parent && child && !edgeExists(parentName, childName)){
        var edge = {
          data: {
            id: getEdgeId(parentName, childName),
            source: parent.n,
            target: child.n,
            size: ommitEdge ? 10 : getSize(child) / 4,
            weight: ommitEdge ? 10 : getSize(child) / 4
          },
          style: {
            'line-color': ommitEdge ? '#ccc' : '#888',
            'curve-style': 'bezier'
          }
        }
        if(ommitEdge){
          edge.style['mid-target-arrow-color'] = '#ccc';
          edge.style['mid-target-arrow-shape'] = 'triangle';
        }
        else{
          edge.style['mid-target-arrow-shape'] = 'triangle';
          
        }
        if (vm.currentLayout == 'tree') {
          edge.style['width'] = ommitEdge ? 10 : getSize(child) / 4;
          if(ommitEdge){
            edge.style['arrow-scale'] = 100;
          }
          else{
            edge.style['arrow-scale'] = 2;
            
          }
        }
        if(vm.library == Library.Cytoscape)
          convertedData.push(edge);
        else
          convertedData.edges.push(edge.data);

      }
      cyNode.style = {
        'content': 'XLSX',
        'text-valign': 'center',
        'color': 'white',
        'text-outline-color': whatToAdd == 'parent' ? '#ccc' :'#888',
        'background-color': whatToAdd == 'parent' ? '#ccc' :'#888',
      };
      cyNode.style['font-size'] = (size / 3).toString() + 'px';
      cyNode.style['width'] = size;
      cyNode.style['height'] = size;
      cyNode.data['size'] = size;
      cyNode.data['mass'] = size;
      cyNode.data['label'] = cyNode.style['content'];
      if (vm.currentLayout == 'tree') {
        var base = 1.1;
        var A = sizeCounters[maxExpandedLevel]/5 ;
        var newMaxExpandedLevel = maxExpandedLevel - startingLevel + 1;
        var newLevel = datasetNode.level - startingLevel + 1;
        var X = A / (Math.pow(base, newMaxExpandedLevel - 1) - 1);
        cyNode.position = {
          x: y !== undefined ? y : datasetNode.y,
          y: x !== undefined ? x : Math.pow(base, newMaxExpandedLevel - newLevel)* X * (Math.pow(base,newLevel-1)-1)
        };
      }
      if(vm.library == Library.Sigma){
        (cyNode.data as any).x = vm.currentLayout == 'tree' ? cyNode.position.x : Math.random();
        (cyNode.data as any).y = vm.currentLayout == 'tree' ? cyNode.position.y : Math.random();
      }
      return cyNode;
    }
            
    var getChildrenCount = (parent) => {
      if(!parent.count)
        parent.count = _.sumBy(parent.c, (child:any) => getChildrenCount(child)) + 1;
      return parent.count;
    }
    var createLibraryData = (root,  parentName?: string, level?: number, ancestorList?:string) => {
      if(!level)
        level = 1;
      dict[root.n] = root;
      root.count  = getChildrenCount(root)
      if(!parentName) totalCount = root.count;
      root.level = level;
      root.ancestorList = ancestorList;
      root.parentName = parentName;

      _.each(root.c,(child) => createLibraryData(child, root.n, level + 1, ancestorList + ` -${root.n}- `))

    }

    vm.draw = () => {
      refreshAll()
    } 

    function initCy(then){
      dataset = then[0];
      var styleJson = then[1];
      dict = {};
      createLibraryData(dataset, null, null, '');
      killAll();
      var element = $element.find('.container')[0]
      if(vm.library == Library.Cytoscape)
        cy = (window as any).cy = cytoscape({
          container: element,
          layout: { 
            name: 'preset',
            boundingBox: {x1: 0 ,y1: 0,x2: 1000000,y2: 100000}
          },
          motionBlur: true,
          selectionType: 'single',
          boxSelectionEnabled: false,
          hideEdgesOnViewport: true,
          style: (cytoscape as any).stylesheet()
          .selector('node')
            .css({
              'text-valign': 'center',
              'color': 'white',
              'text-outline-width': 2,
              'text-outline-color': '#888',
              'background-color': '#888'
            })
        });
      if(vm.library == Library.Sigma){
        s = new sigma(element)
        sigma.plugins.dragNodes(s, s.renderers[0]);
        s.settings({
                        hideEdgesOnMove: true,
                        minNodeSize:0,
                        maxNodeSize:0,
                        minEdgeSize:0,
                        maxEdgeSize:0,
                        zoomMax: 10,
                        zoomMin: 0.0001
                      })
      }
      if(vm.library == Library.Cytoscape){
        var options = {
          // List of initial menu items
          menuItems: [
            {
              id: 'collapse', // ID of menu item
              content: 'Collapse', // Display content of menu item
              tooltipText: 'Collapse', // Tooltip text for menu item
              selector: 'node[expandable]', 
              onClickFunction: function (event) { // The function to be executed on click
                var target = event.target || event.cyTarget;
                cy.remove(cy.$(`[ancestors *= "-${target.id()}-"]`))
                target.style('shape', 'rectangle')
                target.style('content', '+' + getChildrenCount(dict[target.id()]));
              }
            },
            {
              id: 'expand', // ID of menu item
              content: 'Expand', // Display content of menu item
              tooltipText: 'Expand', // Tooltip text for menu item
              selector: 'node[expandable]', 
              onClickFunction: function (event) { // The function to be executed on click
                var target = event.target || event.cyTarget;
                var toAdd = [];
                drawNodesStartingAtRoot(dict[target.id()], toAdd, false);
                cy.add(toAdd);
                target.style('shape', 'ellipse')
                target.style('content', 'XLSX');
              }
            },
            {
              id: 'start-from', // ID of menu item
              content: 'Start from here', // Display content of menu item
              tooltipText: 'Start from here', // Tooltip text for menu item
              selector: 'node', 
              onClickFunction: function (event) { // The function to be executed on click
                var target = event.target || event.cyTarget;
                var id = target.id();
                cy.remove(cy.nodes())
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
                cy.fit(target, 200)
              }
            }
          ],
          // css classes that menu items will have
          menuItemClasses: [
            // add class names to this list
          ],
          // css classes that context menu will have
          contextMenuClasses: [
            // add class names to this list
          ]
        };
        cy.contextMenus(options);

      }
    }
  

    function killAll() {
      if (s) {
        vm.started = undefined;
        s.kill();
        s = undefined;
      }
      if (cy) {
        cy.destroy();
        cy = undefined;
      }
    }
  }
})();
