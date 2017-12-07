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
    var layoutPadding = 50;
    var aniDur = 500;
    var easing = 'linear';
    var cy, dataset, dict;
    var maxExpandedLevel;
    var currentLayout;
    var levelCounters = [];
    var maxLevel = 8;
  
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
  
  
    var drawNodesStartingAtRoot = (root, convertedData) => {

      if(cy.$id(root.n).length == 0){

        var node = {
          data: {
            id: root.n,
            ancestors: root.ancestorList
          },
          position: null,
          style: null
        }
        convertedData.push(node)
        if(root.parentName)
          convertedData.push({
            data: {
              id: `${root.parentName} to ${root.n}`,
              source: root.parentName,
              target: root.n
            },
            style:{
              width: currentLayout == 'tree' ? root.size/2: 3/root.level,
              // 'target-arrow-color': 'black',
              // 'target-arrow-shape': 'triangle',
              // 'curve-style': 'bezier',
              // 'arrow-scale': 3
            }
          })

          
        if(currentLayout == 'tree'){
          var A = levelCounters[maxLevel]*Math.cos(Math.PI/6);
          var X = A/(Math.pow(6,maxLevel-1)-1);
          node.position = {
            y: root.y,
            x: Math.pow(6, maxLevel - root.level)*X*(Math.pow(6,root.level-1)-1)
          }
          node.style = {        
            'content': 'XLSX',
            'text-valign': 'center',
            'color': 'white',
            'font-size': (root.size/2).toString() + 'px',
            'text-outline-color': '#888',
            'background-color': '#888',
            width: root.size,
            height: root.size
          }
        }
        else if (currentLayout == 'fractal'){
            node.position = {
              x: root.x,
              y: root.y
            }
            node.style = {        
              'content': 'XLSX',
              'text-valign': 'center',
              'color': 'white',
              'font-size': (8*Math.pow(maxLevel-root.level+1,1.7)).toString() + 'px',
              'text-outline-color': '#888',
              'background-color': '#888',
              width: 16*Math.pow(maxLevel-root.level+1,1.7),
              height: 16*Math.pow(maxLevel-root.level+1,1.7),
            }
        }
      }
      if(root.level == maxExpandedLevel && root.c.length){
        node.style.shape = 'rectangle';
        node.style.content = '+' + root.count;
      }
      else
        if(root.c.length)
          for(var i = 0; i < root.c.length; i++){
            drawNodesStartingAtRoot(root.c[i], convertedData)
          }

    }
    var populateLevelCounts = (root, levelCounts) => {
      if(!levelCounts[root.level]) levelCounts[root.level] = 0;
      levelCounts[root.level]++;
      if(root.c.length)
        for(var i = 0; i < root.c.length; i++)
          populateLevelCounts(root.c[i], levelCounts);
        
    }
    var getMaxExpandedLevel = (levelCounts) => {
      var s = 0;
      var j;
      for(var i = 0; i < levelCounts.length; i++){
        var levelCount = levelCounts[i] ? levelCounts[i] : 0;
        s += levelCount;
        if(s < 500)
          j = i;
        else
          break; 
      }
      return j;
    }
    var drawUpwards = (root) => {
      var convertedData = [];
      var childName;
      var childSize;
      while(root.parentName){
        
        root = dict[root.parentName];
        var node = {
          data: {
            id: root.n,
            ancestors: root.ancestorList
          },
          position: null,
          style: null
        }
        convertedData.push(node)
        
        if(childName)
          convertedData.push({
            data: {
              id: `${root.n} to ${childName}`,
              source: root.n,
              target: childName
            },
            style:{
              width: currentLayout == 'tree' ? childSize/2 : 3/root.level,
              // 'target-arrow-color': 'black',
              // 'target-arrow-shape': 'triangle',
              // 'curve-style': 'bezier',
              // 'arrow-scale': 3
            }
          })

        if(currentLayout == 'tree'){
          var A = levelCounters[maxLevel]*Math.cos(Math.PI/6);
          var X = A/(Math.pow(6,maxLevel-1)-1);
          node.position = {
            y: root.y,
            x: Math.pow(6, maxLevel - root.level)*X*(Math.pow(6,root.level-1)-1)
          }
          node.style = {        
            'content': 'XLSX',
            'text-valign': 'center',
            'color': 'white',
            'font-size': (root.size/2).toString() + 'px',
            'text-outline-color': '#888',
            'background-color': '#888',
            width: root.size,
            height: root.size
          }
        }
        else if (currentLayout == 'fractal'){
            node.position = {
              x: root.x,
              y: root.y
            }
            node.style = {        
              'content': 'XLSX',
              'text-valign': 'center',
              'color': 'white',
              'font-size': (8*Math.pow(maxLevel-root.level+1,1.7)).toString() + 'px',
              'text-outline-color': '#888',
              'background-color': '#888',
              width: 16*Math.pow(maxLevel-root.level+1,1.7),
              height: 16*Math.pow(maxLevel-root.level+1,1.7),
            }
        }
        childName = root.n;
        childSize = root.size;
      }
      cy.add(convertedData);
    }
    var drawNodes = (id) => {
      var root = dict[id];
      var convertedData = [];
      var levelCounts = [];
      populateLevelCounts(root, levelCounts);
      maxExpandedLevel = getMaxExpandedLevel(levelCounts);
      drawUpwards(root)
      console.log(levelCounters[maxLevel])
      drawNodesStartingAtRoot(root, convertedData)
      cy.add(convertedData);
    }
    // when both graph export json and style loaded, init cy
    var refreshAll = (layoutType: string) => $q.all([ graphP(), styleP ]).then(data => {
      currentLayout = layoutType;
      initCy(data);
      drawNodes(dataset.n);
      cy.fit(cy.$id(dataset.n), 200);
    });
  
    var allNodes = null;
    var allEles = null;
    var lastHighlighted = null;
    var lastUnhighlighted = null;
  
    function getFadePromise( ele, opacity ){
      return ele.animation({
        style: { 'opacity': opacity },
        duration: aniDur
      }).play().promise();
    };
  
    var restoreElesPositions = function( nhood ){
      return $q.all( nhood.map(function( ele ){
        var p = ele.data('orgPos');
  
        return ele.animation({
          position: { x: p.x, y: p.y },
          duration: aniDur,
          easing: easing
        }).play().promise();
      }) );
    };
  
    function highlight( node ){
      var oldNhood = lastHighlighted;
  
      var nhood = lastHighlighted = node.closedNeighborhood();
      var others = lastUnhighlighted = cy.elements().not( nhood );
  
      var reset = function(){
        cy.batch(function(){
          others.addClass('hidden');
          nhood.removeClass('hidden');
  
          allEles.removeClass('faded highlighted');
  
          nhood.addClass('highlighted');
  
          others.nodes().forEach(function(n){
            var p = n.data('orgPos');
  
            n.position({ x: p.x, y: p.y });
          });
        });
  
        return $q.resolve().then(function(){
          if( isDirty() ){
            return fit();
          } else {
            return $q.resolve();
          };
        }).then(function(){
            return delay(aniDur);
        });
      };
  
      var runLayout = function(){
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
          concentric: function( ele ){
            if( ele.same( node ) ){
              return 2;
            } else {
              return 1;
            }
          },
          levelWidth: function(){ return 1; },
          padding: layoutPadding
        });
  
        var promise = cy.promiseOn('layoutstop');
  
        l.run();
  
        return promise;
      };
  
      var fit = function(){
        return cy.animation({
          fit: {
            eles: nhood.filter(':visible'),
            padding: layoutPadding
          },
          easing: easing,
          duration: aniDur
        }).play().promise();
      };
  
      var showOthersFaded = function(){
        return delay( 250 ).then(function(){
          cy.batch(function(){
            others.removeClass('hidden').addClass('faded');
          });
        });
      };
  
      return $q.when()
        .then( reset )
        .then( runLayout )
        .then( fit )
        .then( showOthersFaded )
      ;
  
    }
  
      function delay(duration: number):angular.IPromise<any> {
          var deferred = $q.defer();
          $timeout(() => deferred.resolve(), duration);
          return deferred.promise;
      }

    function isDirty(){
      return lastHighlighted != null;
    }
  
    function clear( opts? ){
      if( !isDirty() ){ return $q.when(); }
  
      opts = $.extend({
  
      }, opts);
  
      cy.stop();
      allNodes.stop();
  
      var nhood = lastHighlighted;
      var others = lastUnhighlighted;
  
      lastHighlighted = lastUnhighlighted = null;
  
      var hideOthers = function(){
        return delay( 125 ).then(function(){
          others.addClass('hidden');
  
          return delay( 125 );
        });
      };
  
      var showOthers = function(){
        cy.batch(function(){
          allEles.removeClass('hidden').removeClass('faded');
        });
  
        return delay( aniDur );
      };
  
      var restorePositions = function(){
        cy.batch(function(){
          others.nodes().forEach(function( n ){
            var p = n.data('orgPos');
  
            n.position({ x: p.x, y: p.y });
          });
        });
  
        return restoreElesPositions( nhood.nodes() );
      };
  
      var resetHighlight = function(){
        nhood.removeClass('highlighted');
      };
  
      return $q.when()
        .then( resetHighlight )
        .then( hideOthers )
        .then( restorePositions )
        .then( showOthers )
      ;
    }
  
    // function showNodeInfo( node ){
    //   $('#info').html( infoTemplate( node.data() ) ).show();
    // }
  
    function hideNodeInfo(){
      $('#info').hide();
    }
    

    var getFractalPosition = (self, R, oldTheta?) => {
      if(!self.c.length)
        return;
      if(!R) R = 5000;
      if(!oldTheta) oldTheta = Math.PI;
      var n = self.c.length;
      var theta = 2*Math.PI/n;
      var newR = R*Math.sin(6*oldTheta/20);
      for(var k = 0; k< n;k++){
        var child = self.c[k];
        child.x = self.x + newR*Math.cos(theta*k);
        child.y = self.y + newR*Math.sin(theta*k);
        getFractalPosition(child, newR, theta);
      }
    }

    var getY = (self, level:number, levelCounters) => {
      if(!levelCounters[level]) levelCounters[level] = 0;
      var children = self.c;
      self.size = 10*Math.pow(6,maxLevel-level);
      if(!children.length){
        for(var i = level; i < maxLevel + 1; i++){
          if(!levelCounters[i]) levelCounters[i] = 0;
          levelCounters[i] += 2 * self.size;
        }
        self.y = levelCounters[level] - self.size/2;
        return self.y;
      }
      else{
        var first,last;
        for(var j = 0; j < children.length; j++){
          var child = children[j];
          if(!child.y)
            child.y = getY(child, level + 1, levelCounters)
          if(j == 0) first = child;
          if(j == children.length -1) last = child;
        }
        levelCounters[level] = last.y + self.size;
        return (first.y + last.y) / 2;
      }
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
      root.level = level;
      root.ancestorList = ancestorList;
      root.parentName = parentName;

      _.each(root.c,(child) => createCyData(child, root.n, level + 1, ancestorList + ` -${root.n}- `))

      if(currentLayout == 'tree'){
        root.x = root.x ? root.x : 7000*Math.log(level);
        root.y = root.y ? root.y : getY(root, level, levelCounters)
      }
      else if (currentLayout == 'fractal'){
        
      }

    }

    vm.draw = (layoutType: string) => {
      refreshAll(layoutType)
    } 

    function initCy( then){
      var loading = document.getElementById('loading');
      dataset = then[0];
      var styleJson = then[1];
      var elements = [];
      if(!currentLayout) currentLayout = 'fractal';
      if(currentLayout == 'fractal'){
        dataset.x = 0;
        dataset.y = 0;
        getFractalPosition(dataset, 0);
      }
      else if(currentLayout == 'tree'){
        levelCounters = [];
      }
      dict = {};
      createCyData(dataset, null, null, '');
  
      cy = (window as any).cy = cytoscape({
        container: $element.find('.container')[0],
        layout: { 
          name: 'preset',
          boundingBox: {x1: 0 ,y1: 0,x2: 1000000,y2: 100000}} as any,
        motionBlur: true,
        selectionType: 'single',
        boxSelectionEnabled: false,
        autoungrabify: true,
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
            selector: 'node', 
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
            selector: 'node', 
            onClickFunction: function (event) { // The function to be executed on click
              var target = event.target || event.cyTarget;
              var toAdd = [];
              drawNodesStartingAtRoot(dict[target.id()], toAdd);
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
  
    var lastSearch = '';
  
  }
})();
