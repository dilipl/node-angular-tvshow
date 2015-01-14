
/**
* Module dependencies.
*/

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var async = require('async');
var request = require('request');
var xml2js = require('xml2js');
var _ = require('lodash');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var showSchema = new mongoose.Schema({
	_id: Number,
	name: String,
	airDaysOfWeek: String,
	airsTime: String,
	firstAired: Date,
	genre: [String],
	network: String,
	overview: String,
	rating: Number,
	ratingCount: Number,
	status: String,
	poster: String,
	subscribers: [{
		type: mongoose.Schema.Types.ObjectId, ref: 'User'
	}],
	episodes: [{
		season: Number,
		episodeNumber: Number,
		episodeName: String,
		firstAired: Date,
		overview: String
	}]  
});

var userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
});

userSchema.pre('save', function(next) {
  var user = this;
  if (!user.isModified('password')) return next();
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});
userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

var User = mongoose.model('User', userSchema);
var Show = mongoose.model('Show', showSchema);

passport.serializeUser(function(user, done){
	done(null, user.id);
});

passport.deserializeUser(function(id, done){
	User.findById(id, function(err, user){
		done(err, user);
	});
});
passport.use(new LocalStrategy({usernameField: 'email'}, function(email, password, done){
	User.findOne({email: email}, function(err, user){
		if(err){
			return done(err);
		}
		if(!user){
			return done(null, false);
		}
		user.comparePassword(password, function(err, isMatch){
		if(err){
			return done(err);
		}			
		if(isMatch){
			return done(null, user);
		}
		return done(null, false);
		});
	});
}));
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) next();
  else res.send(401);
}

mongoose.connect('localhost');

var app = express();
// all environments
app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/shows', function(req,res, next){
	var query = Show.find();
	if(req.query.genre){
		query.where({genre: req.query.genre});
	} else if(req.query.alphabet){
		query.where({alphabet: req.query.alphabet});
	} else{
		query.limit(12);
	}
	query.exec(function(err, shows){
		if(err){
			return next(err);
		}
		res.send(shows);
	});
});

app.get('/api/shows/:id', function(req, res, next){
	Show.findById(req.params.id, function(err, show){
		if(err){
			return next(err);
		}
		console.log(show);
		res.send(show);		
	});
});

app.post('/api/shows', function(req, res, next){
	var apiKey = '9EF1D1E7D28FDA0B';
	var showName = req.body.showName
		.toLowerCase()
    .replace(/ /g, '_')
    .replace(/[^\w-]+/g, '');
	var parser = xml2js.Parser({
    explicitArray: false,
    normalizeTags: true
  });
	async.waterfall([
		function(callback){
			request.get('http://thetvdb.com/api/GetSeries.php?seriesname=' + showName, function(error, response, body){
				if(error){
					callback(error);
				}
				parser.parseString(body, function(err, result){
					if(err)	{
						callback(err);
					}
					if(!result.data.series){
						return res.send(404, {message: req.body.showName + 'not found'});	
					}
					var seriesId = result.data.series.seriesid || result.data.series[0].seriesid;
					callback(null, seriesId);
				});
			});	
		},
		function(seriesId, callback){
			request.get('http://thetvdb.com/api/9EF1D1E7D28FDA0B/series/' + seriesId + '/all/en.xml', function(error, response, body){
				if(error){
					callback(error);
				}	
				parser.parseString(body, function(err, result){
					if(err)	{
						callback(err);
					}
					var series = result.data.series;
					var episodes = result.data.episode;
					var show = new Show({
						_id: series.id,
						name: series.seriesName,
						airDaysOfWeek: series.airs_DayOfWeek,
						airsTime: series.airs_Time,
						firstAired: series.firstAired,
						genre: series.genre.split('|').filter(Boolean),
						network: series.network,
						overview: series.overview,
						rating: series.rating,
						ratingCount: series.ratingCount,
						status: series.status,
						poster: series.poster,
						episodes: []
					});
					_.each(episodes, function(episode){
						show.episodes.push({
							season: episode.combined_season,
							episodeNumber: episode.combined_episodenumber,
							episodeName: episode.episodeName,
							firstAired: episode.firstAired,
							overview: episode.overview		
						});
					});
					callback(err, show);
				});

			});
		},
		function(show, callback){
			var url = 'http://thetvdb.com/banners/' + show.poster;
			request.get({url: url, encoding: null}, function(error, response, body){
				if(error){
					callback(error);
				}	
				show.poster = 'data:' + response.headers['content-type'] + ';base64,' + body.toString('base64');
				callback(null, show);
			});
		}
	],function(err, show){
			if(err){
				next(err);
			}
			show.save(function(err){
				if(err){
				        if (err.code == 11000) {
          return res.send(409, { message: show.name + ' already exists.' });
        }
        return next(err);	
				}
				res.send(200);
			});

	});

});
app.post('/api/login', passport.authenticate('local'), function(req, res){
	res.cookie('user', JSON.stringify(req.user));
	res.send(req.user);
});

app.post('/api/signup', function(req,res,next){
	var user = new User({
		email: req.body.email,
		password: req.body.password
	});
	user.save(function(err){
    if (err) return next(err);
    res.send(200);
	});
});

app.post('/api/subscribe', function(req, res, next){
	Show.findById(req.body.showId, function(err, show){
		if(err){
			return next(err);
		}
		show.subscribers.push(req.user.id);
		show.save(function(err){
		if(err){
			return next(err);
		}
		return res(200);
		});
	});	
});

app.post('/api/unsubscribe', function(req, res, next){
	Show.findById(req.body.showId, function(err, show){
	if(err){
		return next(err);
	}	
	var index = show.subscribers.indexOf(req.user.id);
	show.subscribers.splice(index, 1);
	show.save(function(err){
	if(err){
		return next(err);
	}
	return res(200);
	});
});	
});

app.get('/api/logout', function(req, res, next){
	req.logout();
	res.send(200);
});

app.get('*', function(req, res) {
  res.redirect('/#' + req.originalUrl);
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.send(500, { message: err.message });	
});
app.use(function(req, res, next) {
  if (req.user) {
    res.cookie('user', JSON.stringify(req.user));
  }
  next();
});
http.createServer(app).listen(app.get('port'), function(){
console.log('Express server listening on port nf114-4two' + app.get('port'));
});



