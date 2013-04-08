/*
	MediaCenterJS - A NodeJS based mediacenter solution
	
    Copyright (C) 2013 - Jan Smolders

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var express = require('express')
, app = express()
, fs = require ('fs')
, dateFormat = require('dateformat')

var configfile = []
,configfilepath = './configuration/setup.js'
,configfile = fs.readFileSync(configfilepath)
,configfileResults = JSON.parse(configfile);	

app.configure(function(){
	app.set('view engine', 'jade');
	app.set('views', __dirname + '/views');
	app.locals.pretty = true;
	app.setMaxListeners(100);
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/public'));
	app.use(express.favicon(__dirname + '/public/core/favicon.ico'));
	app.use(app.router);
});

app.configure('development', function(){   
	app.enable('verbose errors');
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));  
});

app.configure('production', function(){
	app.disable('verbose errors');
	app.use(express.errorHandler()); 
});   

require('./lib/boot')(app,{ verbose: !module.parent });
app.get("/", function(req, res, next) {  
	if(	configfileResults.moviepath == '' && configfileResults.language == '' && configfileResults.location == '' || configfileResults.moviepath == null || configfileResults.moviepath == undefined){
		res.render('setupsettings');	
	} else {
		var apps = []
		//Search app folder for apps and check if tile icon is present
		fs.readdirSync(__dirname + '/apps').forEach(function(name){
			if(fs.existsSync(__dirname + '/public/'+name+'/tile.png')){
				apps.push(name)
			}
		});
		var now = new Date();
		var time = dateFormat(now, "HH:MM");
		var date = dateFormat(now, "dd-mm-yyyy");
		req.setMaxListeners(0)
		res.render('index', {
			title: 'Homepage',
			time: time,
			date: date,
			apps: apps
		});	
	}
});

app.get("/settings/", function(req, res, next) {  
	res.render('settings');	
});


//	Handle the initial setup. Because this is very generic and should only be launched once at first boot,
//	I decided to keep it in the initial app.js file. Could be moved later though

app.post('/settings', function(req, res){
	// Fill JSON array with new settings
	var myData = {
		moviepath : req.body.movielocation
		,highres: req.body.highres
		,musicpath : req.body.musiclocation
		,tvpath : req.body.tvlocation
		,language : req.body.language
		,onscreenkeyboard: req.body.usekeyboard
		,location: req.body.location
		,screensaver: req.body.screensaver
	}
	
	// Write to JSON file
	fs.writeFile(configfilepath, JSON.stringify(myData, null, 4), function(err, callback) {
		if(err) {
			// Respond to client with sever error
			res.send(500);
			console.log(err);
		} else {
			
			//Get all movie files and ignore other files. (str files will be handled later)
			fs.readdir(configfileResults.moviepath,function(err,files){
				if (err) throw err;
				var allMovies = new Array();
				files.forEach(function(file){
					if (file.match(/\.(avi|mkv|mpeg|mpg|mov|mp4|txt)/i,"")){
						movieFiles = file
						/*, year = movieFiles.match(/\(.*?([0-9]{4}).*?\)/)
						, stripped = movieFiles.replace(/\.|_|\/|\+|-/g," ")
						, noyear = stripped.replace(/([0-9]{4})|\(|\)|\[|\]/g,"")
						, releasegroups = noyear.replace(/FxM|aAF|arc|AAC|MLR|AFO|TBFA|WB|ARAXIAL|UNiVERSAL|ToZoon|PFa|SiRiUS|Rets|BestDivX|NeDiVx|SER|ESPiSE|iMMORTALS|QiM|QuidaM|COCAiN|DOMiNO|JBW|LRC|WPi|NTi|SiNK|HLS|HNR|iKA|LPD|DMT|DvF|IMBT|LMG|DiAMOND|DoNE|D0PE|NEPTUNE|TC|SAPHiRE|PUKKA|FiCO|PAL|aXXo|VoMiT|ViTE|ALLiANCE|mVs|XanaX|FLAiTE|PREVAiL|CAMERA|VH-PROD|BrG|replica|FZERO/g, "")
						, movietype = releasegroups.replace(/dvdrip|multi9|xxx|web|hdtv|vhs|embeded|embedded|ac3|dd5 1|m sub|x264|dvd5|dvd9|multi sub|non sub|subs|ntsc|ingebakken|torrent|torrentz|bluray|brrip|sample|xvid|cam|camrip|wp|workprint|telecine|ppv|ppvrip|scr|screener|dvdscr|bdscr|ddc|R5|telesync|telesync|pdvd|1080p|hq|sd|720p|hdrip/gi, "")
						, noCountries = movietype.replace(/NL|SWE|SWESUB|ENG|JAP|BRAZIL|TURKIC|slavic|SLK|ITA|HEBREW|HEB|ESP|RUS|DE|german|french|FR|ESPA|dansk|HUN/g,"")
						, movieTitle = noCountries.trimRight()*/
						
						allMovies[allMovies.length] = movieFiles;
					}
				});
				var allMoviesJSON = JSON.stringify(allMovies, null, 4);
				fs.writeFile(movielistpath, allMoviesJSON, function(e) {
					if (!e) {
						console.log('writing', allMoviesJSON);
						// Respond to client giving the ok, set a timeout to give supervisor time to reload the server
						res.render('thanks');
					}else{ 
						console.log('Error getting movielist', e);
					};
				});
			});

		}
	}); 
});



// Open App socket
app.listen(3000);
console.log("MediacenterJS listening on port: 3000"); 