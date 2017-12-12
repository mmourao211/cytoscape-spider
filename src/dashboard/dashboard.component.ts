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

  function DashboardController($element: JQuery, $q: angular.IQService, $timeout: angular.ITimeoutService) {
    const vm = this;
    var cy, dataset, dict;
    var maxExpandedLevel;
    var currentLayout;
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
  
  
    var drawNodesStartingAtRoot = (root, convertedData, ommitStartingEdge) => {
      var nodeAlreadyExists = cy.$id(root.n).length != 0;
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
        if(s < 500)
          j = i;
        else
          break; 
      }
      return j;
    }

    var drawUpwards = (root) => {
      var first = root;
      var convertedData = [];
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
      cy.add(convertedData);
    }
    var drawNodes = (id) => {
      var root = dict[id];
      var convertedData = [];
      levelCounters = [];
      sizeCounters = [];
      totalCount = 0;
      startingLevel = root.level;
      populateLevelCounts(root);
      maxExpandedLevel = getMaxExpandedLevel();
      getY(root);
      drawUpwards(root)
      drawNodesStartingAtRoot(root, convertedData, true)
      cy.add(convertedData);
      if(currentLayout == 'fractal')
        cy.layout({
          name: 'cose', 
          randomize: true
        }).run();
      cy.fit(cy.nodes());
    }
    // when both graph export json and style loaded, init cy
    var refreshAll = (layoutType: string) => $q.all([ graphP(), styleP ]).then(data => {
      currentLayout = layoutType;
      initCy(data);
      drawNodes(dataset.n);
    });
  
    var getEdgeId = (parentName, childName) => `${parentName} to ${childName}`
    var edgeExists = (parentName, childName) => !!cy.$id(getEdgeId(parentName, childName)).length

    var getSize = (node) => 10000 * node.level * Math.sqrt(node.count / (2*Math.PI*totalCount));
    

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
    var addCyDataToQueue = (convertedData: any[], childName, parentName, whatToAdd, y?, x?, size?, ommitEdge?) => {
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
      convertedData.push(cyNode);
      if (parent && child && !edgeExists(parentName, childName)){
        var edge = {
          data: {
            id: getEdgeId(parentName, childName),
            source: parent.n,
            target: child.n
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
        if (currentLayout == 'tree') {
          edge.style['width'] = ommitEdge ? 10 : getSize(child) / 4;
          if(ommitEdge){
            edge.style['arrow-scale'] = 100;
          }
          else{
            edge.style['arrow-scale'] = 2;
            
          }
        }
        convertedData.push(edge);

      }
      cyNode.style = {
        'content': 'XLSX',
        'text-valign': 'center',
        'color': 'white',
        'text-outline-color': whatToAdd == 'parent' ? '#ccc' :'#888',
        'background-color': whatToAdd == 'parent' ? '#ccc' :'#888',
      };
      if (currentLayout == 'tree') {
        cyNode.style['font-size'] = (size / 3).toString() + 'px';
        cyNode.style['width'] = size;
        cyNode.style['height'] = size;
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
      return cyNode;
    }
            
    var getChildrenCount = (parent) => {
      if(!parent.count)
        parent.count = _.sumBy(parent.c, (child:any) => getChildrenCount(child)) + 1;
      return parent.count;
    }
    var createCyData = (root,  parentName?: string, level?: number, ancestorList?:string) => {
      if(!level)
        level = 1;
      dict[root.n] = root;
      root.count  = getChildrenCount(root)
      if(!parentName) totalCount = root.count;
      root.level = level;
      root.ancestorList = ancestorList;
      root.parentName = parentName;

      _.each(root.c,(child) => createCyData(child, root.n, level + 1, ancestorList + ` -${root.n}- `))

    }

    vm.draw = (layoutType: string) => {
      refreshAll(layoutType)
    } 

    function initCy(then){
      var loading = document.getElementById('loading');
      dataset = then[0];
      var styleJson = then[1];
      var elements = [];
      dict = {};
      createCyData(dataset, null, null, '');
  
      cy = (window as any).cy = cytoscape({
        container: $element.find('.container')[0],
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
})();
