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
  
    var cy;
  
    // get exported json from cytoscape desktop via ajax
    var graphP = $.ajax({
      url: '../../data/example.json', // wine-and-cheese.json
      //url: '../../data/example-3276.json', // wine-and-cheese.json
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
  
  
    // when both graph export json and style loaded, init cy
    $q.all([ graphP, styleP ]).then(initCy);
  
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
    
    var levelCounters = [];
    var maxLevel = 8;

    var getX = (self, children, level:number, levelCounters) => {
      if(!levelCounters[level]) levelCounters[level] = 0;
      if(!children.length){
        for(var i = level; i < maxLevel + 1; i++){
          if(!levelCounters[i]) levelCounters[i] = 0;
          levelCounters[i] += 1;
        }
        self.x = levelCounters[level];
        self.size = 1;
        return self.x;
      }
      else{
        var first,last, size;
        size = 0;
        for(var j = 0; j < children.length; j++){
          var child = children[j];
          if(!child.x)
            child.x = getX(child, child.children, level + 1, levelCounters)
          if(j == 0) first = child.x;
          if(j == children.length -1) last = child.x;
          size += child.size;
        }
        self.size = size*(level)/(maxLevel);
        levelCounters[level] = last;
        return (first + last) / 2;
      }
    }

    var createCyData = (data, convertedData: Array<any>, parentName?: string, level?: number) => {
      if(!level)
        level = 1;
      var node = {
        data: {
          id: data.name
        },
        position: null,
        style: null
      }
      convertedData.push(node)
      convertedData.push({
        data: {
          id: `${parentName} to ${data.name}`,
          source: parentName,
          target: data.name
        },
        style:{
          'target-arrow-color': 'black',
          'target-arrow-shape': 'triangle'
        }
      })

      _.each(data.children,(child) => createCyData(child, convertedData, data.name, level + 1))

      node.position = {
        x: 100 * (data.x ? data.x : getX(data, data.children, level, levelCounters)),
        y: 1000 * level
      }

      node.style = {
        width: maxLevel*data.size,
        height: maxLevel*data.size,
        label: data.name,
        'font-size':Math.floor(8*maxLevel/level),
        'min-zoomed-font-size': 8
      }

      // console.log('x:' + node.position.x + ' y:' + node.position.y)
    }

    function initCy( then ){
      var loading = document.getElementById('loading');
      var expJson = then[0];
      var styleJson = then[1];
      var elements = [];
      
      createCyData(expJson, elements);
  
      $(loading).addClass('loaded');
      cy = (window as any).cy = cytoscape({
        container: $element.find('.container')[0],
        layout: { 
          name: 'preset',
          boundingBox: {x1: 0 ,y1: 0,x2: 1000000,y2: 100000}} as any,
        //style: styleJson,
        elements: elements,
        motionBlur: true,
        selectionType: 'single',
        boxSelectionEnabled: false,
        autoungrabify: true,
        //pixelRatio: 1,
        //textureOnViewport: true,
        hideEdgesOnViewport: true
      });
      setTimeout( function(){
        cy.fit(cy.$id(expJson.name), 200)
    }, 1000 );
  
      // allNodes = cy.nodes();
      // console.log(allNodes.length)
      // allEles = cy.elements();
  
      // cy.on('free', 'node', function( e ){
      //   var n = e.cyTarget;
      //   var p = n.position();
  
      //   n.data('orgPos', {
      //     x: p.x,
      //     y: p.y
      //   });
      // });
  
      // cy.on('tap', function(){
      //   $('#search').blur();
      // });
  
      // cy.on('select unselect', 'node', _.debounce( function(e){
      //   var node = cy.$('node:selected');
  
      //   if( node.nonempty() ){
      //     // showNodeInfo( node );
  
      //     $q.when().then(function(){
      //       return highlight( node );
      //     });
      //   } else {
      //     hideNodeInfo();
      //     clear();
      //   }
  
      // }, 100 ) );
  
    }
  
    var lastSearch = '';
  
  
    $('#reset').on('click', function(){
      if( isDirty() ){
        clear();
      } else {
        allNodes.unselect();
  
        hideNodeInfo();
  
        cy.stop();
  
        cy.animation({
          fit: {
            eles: cy.elements(),
            padding: layoutPadding
          },
          duration: aniDur,
          easing: easing
        }).play();
      }
    });
  
    $('#filters').on('click', 'input', function(){
  
      var soft = $('#soft').is(':checked');
      var semiSoft = $('#semi-soft').is(':checked');
      var na = $('#na').is(':checked');
      var semiHard = $('#semi-hard').is(':checked');
      var hard = $('#hard').is(':checked');
  
      var red = $('#red').is(':checked');
      var white = $('#white').is(':checked');
      var cider = $('#cider').is(':checked');
  
      var england = $('#chs-en').is(':checked');
      var france = $('#chs-fr').is(':checked');
      var italy = $('#chs-it').is(':checked');
      var usa = $('#chs-usa').is(':checked');
      var spain = $('#chs-es').is(':checked');
      var switzerland = $('#chs-ch').is(':checked');
      var euro = $('#chs-euro').is(':checked');
      var newWorld = $('#chs-nworld').is(':checked');
      var naCountry = $('#chs-na').is(':checked');
  
      cy.batch(function(){
  
        allNodes.forEach(function( n ){
          var type = n.data('NodeType');
  
          n.removeClass('filtered');
  
          var filter = function(){
            n.addClass('filtered');
          };
  
          if( type === 'Cheese' || type === 'CheeseType' ){
  
            var cType = n.data('Type');
            var cty = n.data('Country');
  
            if(
              // moisture
                 (cType === 'Soft' && !soft)
              || (cType === 'Semi-soft' && !semiSoft)
              || (cType === undefined && !na)
              || (cType === 'Semi-hard' && !semiHard)
              || (cType === 'Hard' && !hard)
  
              // country
              || (cty === 'England' && !england)
              || (cty === 'France' && !france)
              || (cty === 'Italy' && !italy)
              || (cty === 'US' && !usa)
              || (cty === 'Spain' && !spain)
              || (cty === 'Switzerland' && !switzerland)
              || ( (cty === 'Holland' || cty === 'Ireland' || cty === 'Portugal' || cty === 'Scotland' || cty === 'Wales') && !euro )
              || ( (cty === 'Canada' || cty === 'Australia') && !newWorld )
              || (cty === undefined && !naCountry)
            ){
              filter();
            }
  
          } else if( type === 'RedWine' ){
  
            if( !red ){ filter(); }
  
          } else if( type === 'WhiteWine' ){
  
            if( !white ){ filter(); }
  
          } else if( type === 'Cider' ){
  
            if( !cider ){ filter(); }
  
          }
  
        });
  
      });
  
    });
  }
})();
