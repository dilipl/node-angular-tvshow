angular.module('MyApp')
.factory('Auth', ['$location', '$cookieStore', '$rootScope', '$alert', '$http', function($location, $cookieStore, $rootScope, $alert, $http){
	$rootScope.currentUser = $cookieStore.get('user');
	$cookieStore.remove('user');

	return{
		login: function(user){
			$http.post('/api/login', user)
				.success(function(data){
					$rootScope.currentUser = data;
					$location.path('/');

					$alert({
				    title: 'Cheers!',
            content: 'You have successfully logged in.',
            placement: 'top-right',
            type: 'success',
            duration: 3	
					});
				})
				.error(function(data){
					$alert({
            title: 'Error!',
            content: 'Invalid username or password.',
            placement: 'top-right',
            type: 'danger',
            duration: 3
					});
				});
		},
		signup: function(user){
			$http.post('/api/signup', user)
				.success(function(){
          $location.path('/login');
          $rootScope.currentUser = null;
          $cookieStore.remove('user');
          $alert({
            title: 'Congratulations!',
            content: 'Your account has been created.',
            placement: 'top-right',
            type: 'success',
            duration: 3
          });					
				})
				.error(function(data){
          $alert({
            title: 'Error!',
            content: response.data,
            placement: 'top-right',
            type: 'danger',
            duration: 3
          });
        });
		},
		logout: function(){
			$http.get('/api/logout')	
				.success(function(){

          $alert({
            content: 'You have been logged out.',
            placement: 'top-right',
            type: 'info',
            duration: 3
          });
				});
		}
	};
}]);