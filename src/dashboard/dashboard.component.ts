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


  enum NodeProperty{
    Created,
    Modified,
    Risk,
    Links,
    Descendands,
    Exists
  }

  enum PropertyType{
    Number,
    Date,
    Boolean
  }

  enum ViewType{
    Risk,
    Age,
    Size
  }

  enum FilterType{
    Spreadsheets = 'Spreadsheets',
    Databases = 'Databases'
  }
  enum RiskCategory{
    None,
    Low,
    Medium,
    High
  }
  enum FileType{
    Spreadsheets,
    Databases
  }

  DashboardController.$inject = ['$element','$scope', '$q', '$timeout', '$window'];
 
  function DashboardController($element: JQuery,$scope: angular.IScope, $q: angular.IQService, $timeout: angular.ITimeoutService, $window: angular.IWindowService) {
    const vm = this;
    vm.nodeProperties = _.map(_.filter(NodeProperty, prop => angular.isNumber(prop)), prop=> prop);
    vm.viewTypes = _.map(_.filter(ViewType, prop => angular.isNumber(prop)), prop=> prop);
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
    vm.filters = {}
    vm.getFiltersActive = () => _.some(vm.filters, filter => filter !== undefined)
    vm.getFilterActive = (filter) => !!vm.filters[FilterType[filter]];
    vm.toggleFilter = (filter) => vm.filters[FilterType[filter]] = !vm.filters[FilterType[filter]]; 
    vm.resetFilters = () => _.each(_.keys(vm.filters), key => vm.filters[key] = undefined);
    vm.currentLayout = 'tree';
    vm.maxNodes = 500;
    var dataset, dict,s;
    var maxExpandedLevel;
    var levelCounters = [];
    var sizeCounters = [];
    var totalCount = 0;
    var startingLevel = 1;
    $scope.$watch(()=> [vm.filters, vm.view], () => s && refreshGraph(), true);
    var refreshGraph = () => {
      s.refresh();
      s.refresh();
    }
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
  
    var doesNodeAlreadyExist = (id) =>  !!s.graph.nodes(id);
  
    var drawNodesStartingAtRoot = (root, convertedData, ommitStartingEdge) => {
      var nodeAlreadyExists = doesNodeAlreadyExist(root.n);
      if(!nodeAlreadyExists){
        var nodeToAdd = addCyDataToQueue(convertedData, root.n, root.parentName,'child', undefined, undefined, undefined, ommitStartingEdge)
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
      var convertedData =  {nodes: [], edges: []};
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
      s.graph.read(convertedData)
      s.refresh()
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

    // test
    
    var drawNodes = (id) => {
      var root = dict[id];
      var convertedData = {nodes: [], edges: []};
      levelCounters = [];
      sizeCounters = [];
      totalCount = 0;
      startingLevel = root.level;
      populateLevelCounts(root);
      maxExpandedLevel = getMaxExpandedLevel();
      getY(root);
      drawUpwards(root)
      vm.nodesCount = 0;
      vm.linksCount = 0;
      vm.databasesCount = 0;
      vm.spreadsheetsCount = 0;
      drawNodesStartingAtRoot(root, convertedData, true)
      s.graph.read(convertedData)
      if(vm.currentLayout == 'fractal'){
        vm.start();
      }
      $timeout(()=>{
        resizeCanvas();
        s.refresh();
        
      })
    }
    // when both graph export json and style loaded, init cy
    var refreshAll = () => $q.all([ graphP(), styleP ]).then(data => {
      initCy(data);
      drawNodes(dataset.n);
    });
  
    var getEdgeId = (parentName, childName) => `${parentName} to ${childName}`
    var edgeExists = (parentName, childName) => !!s.graph.edges(getEdgeId(parentName, childName))

    var getSize = (node) => 100 * Math.sqrt(node.count / (2*Math.PI*totalCount));
    

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
    var assignNodeColor = (node) => {
      if(vm.view == ViewType.Risk){
        switch(node.riskCategory){
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
      else{
        node.color = '#000';
      }
      
      if(vm.getFiltersActive()){
        var tempColor = '#bbb';
        if(vm.filters[FilterType.Databases] && node.filetype == FileType.Databases){
          tempColor = node.color;
        }
        if(vm.filters[FilterType.Spreadsheets] && node.filetype == FileType.Spreadsheets){
          tempColor = node.color;
        }
        node.color = tempColor;
      }
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
      convertedData.nodes.push(cyNode.data);
      vm.nodesCount++;
      if(datasetNode.t == FileType.Databases)
        vm.databasesCount++;
      else
        vm.spreadsheetsCount++;
      if (parent && child && !edgeExists(parentName, childName)){
        var edge = {
          data: {
            id: getEdgeId(parentName, childName),
            source: parent.n,
            target: child.n,
            size: ommitEdge ? 10 : getSize(child) / 4,
            weight: ommitEdge ? 10 : getSize(child) / 4
          }
        }
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
        var A = sizeCounters[maxExpandedLevel]/5 ;
        var newMaxExpandedLevel = maxExpandedLevel - startingLevel + 1;
        var newLevel = datasetNode.level - startingLevel + 1;
        var X = A / (Math.pow(base, newMaxExpandedLevel - 1) - 1);
        cyNode.position = {
          x: y !== undefined ? y : datasetNode.y,
          y: x !== undefined ? x : Math.pow(base, newMaxExpandedLevel - newLevel)* X * (Math.pow(base,newLevel-1)-1)
        };
      }
      (cyNode.data as any).x = vm.currentLayout == 'tree' ? cyNode.position.x : Math.random();
      (cyNode.data as any).y = vm.currentLayout == 'tree' ? cyNode.position.y : Math.random();
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

    var resizeCanvas = ()=> {
      
            var canvas = $element.find('.canvas');
            var container = $element.find('.canvas-container');
            var width = vm.toggled ? container.width() : container.width() + 1024;
            canvas.height(container.height());
            canvas.width(width);
      
          }

    
    $($window).resize(resizeCanvas)
    
    function initCy(then){
      dataset = then[0];
      var styleJson = then[1];
      dict = {};
      createLibraryData(dataset, null, null, '');
      killAll();
      var element = $element.find('.canvas')[0]
      

      sigma.canvas.edges.def = function(edge, source, target, context, settings) {
        var color = edge.color,
            prefix = settings('prefix') || '',
            size = edge[prefix + 'size'] || 1,
            edgeColor = settings('edgeColor'),
            defaultNodeColor = settings('defaultNodeColor'),
            defaultEdgeColor = settings('defaultEdgeColor');
    
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
        context.moveTo(
          source[prefix + 'x'],
          source[prefix + 'y']
        );
        context.lineTo(
          target[prefix + 'x'],
          target[prefix + 'y']
        );
        context.stroke();
      };

      sigma.canvas.nodes.customShape = (node, context, settings) => {
        var prefix = (settings && settings('prefix')) || '',
            size = node[prefix + 'size'], shape = (node.filetype == FileType.Databases ? 'square' : 'circle'), halo, haloColor;
        assignNodeColor(node)
        context.fillStyle = node.color;
        context.beginPath();
        if(shape == 'circle'){
          drawCircle(context, node, prefix);
        }
        else
          drawSquare(context, node, prefix)
        context.closePath();
        context.fill();
        if(halo){
          var previousCompositeOperation = context.globalCompositeOperation;
          context.globalCompositeOperation='destination-over';
          context.fillStyle = haloColor ? haloColor : '#fff';
          context.beginPath();
          if(shape == 'circle')
            drawCircle(context, node, prefix, 2);
          else
            drawSquare(context, node, prefix, 2)
          context.closePath();
          context.fill();
          context.globalCompositeOperation = previousCompositeOperation;
        }
        
      }
      s = new sigma({
        renderers: [
          {
            settings:{
              edgeColor: 'target',
            },
            container: element,
            type: 'canvas' // sigma.renderers.canvas works as well
          } as any
        ]
      } as any);
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
      var drawCircle = (context, node, prefix, ratio:number = 1) => {
        context.arc(
          node[prefix + 'x'],
          node[prefix + 'y'],
          ratio*node[prefix + 'size'],
          0,
          Math.PI * 2,
          true
        );
    
      }
      var drawSquare = (context, node, prefix, ratio:number = 1) => {
        var size = node[prefix + 'size'];
        context.rect(
          node[prefix + 'x'] - ratio*size,
          node[prefix + 'y'] - ratio*size,
          size * 2 * ratio,
          size * 2* ratio
        );
    
      }
      vm.toggle = () => {
        vm.toggled = !vm.toggled;
        $timeout(resizeCanvas, 1000);
      }
    function killAll() {
      if (s) {
        vm.started = undefined;
        s.kill();
        s = undefined;
      }
    }
  }
})();
