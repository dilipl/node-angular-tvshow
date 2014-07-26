angular.module('MyApp')
.controller('DetailCtrl', ['$scope', 'Show', 'Subscription', '$rootScope', '$routeParams', 
function($scope, Show, Subscription, $rootScope, $routeParams){
	Show.get({_id: $routeParams.id}, function(show){
	console.log($routeParams.id);	
	$scope.show = show;
	console.log($scope.show);
	$scope.isSubscribed = function(){
		return $scope.show.subscribers.indexOf($rootScope.currentUser._id) !== -1;
	};
	$scope.subscribe = function(){
		Subscription.subscribe($scope.show).success(function(){
			$scope.show.subscribers.push($rootScope.currentUser._id);	
		});
	};
	$scope.unsubscribe = function(){
		Subscription.unsubscribe($scope.show).success(function(){
			var index = $scope.show.subscribers.indexOf($rootScope.currentUser._id);
			$scope.show.subscribers.splice(index, 1);	
		});
	};
  
  /*$scope.nextEpisode = show.episodes.filter(function(episode) {
  	return new Date(episode.firstAired) > new Date();
  })[0];*/

	});
}]);