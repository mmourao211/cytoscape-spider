'use strict';

(() => {
  angular.module('app', ['ngRoute'])
  .config(['$routeProvider', '$locationProvider',($routeProvider, $locationProvider) => {
    $routeProvider
    .when('/dashboard', {
      template: '<dashboard></dashboard>'
    })
    .otherwise({
      redirectTo: '/dashboard'
    });

    $locationProvider.html5Mode(true);
  }]);
})();
