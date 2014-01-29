/* Global imports */
var colors = require('colors')
	, os = require('os')
	, fs = require('fs.extra')
	, config = require('../../lib/handlers/configuration-handler').getConfiguration();

	var dblite = require('dblite');
	if(os.platform() === 'win32'){
		dblite.bin = "./bin/sqlite3/sqlite3";
	}
	var db = dblite('./lib/database/mcjs.sqlite');
	db.on('info', function (text) { console.log(text) });
	db.on('error', function (err) { console.error('Database error: ' + err) });

/* Public Methods */

/**
 * Starts video streaming for the specified tvShow-File.
 * @param response          The response to write the video stream to
 * @param tvShowUrl          The URL to the tvShow
 * @param tvShowFile         The tvShow-File
 * @param platform          The target platform
 */
exports.startPlayback = function(response, tvShowUrl, tvShowFile, platform) {

    var fileName =  tvShowFile.replace(/\.[^.]*$/,'')
        , outputName =  fileName.replace(/ /g,"-")
        , ExecConfig = {  maxBuffer: 9000*1024 }
        , outputPath = "./public/data/tvShows/"+outputName+".mp4";
	
	if(os.platform() === 'win32'){
		var ffmpegPath = './bin/ffmpeg/ffmpeg.exe'
		ExecConfig = {  maxBuffer: 9000*1024, env: process.env.ffmpegPath };
	}

    GettvShowDurarion(response, tvShowUrl, tvShowFile, platform, function(data){
        var tvShowDuration = data;
        checkProgression(tvShowFile, function(data){
            if(data.progression !== 0 && data !== undefined){
                var tvShowProgression = data.progression;

                if(fs.existsSync(outputPath) === false || data.transcodingstatus === 'pending'){
                    // Start transcode if file was deleted.
                    startTranscoding(platform, tvShowUrl, tvShowFile, outputPath, ExecConfig);
                };

            } else {
                var tvShowProgression = 0;

                if( data.transcodingstatus === 'pending'){
                    if(fs.existsSync(outputPath) === true ){
                        fs.unlinkSync(outputPath);
                    };
                    startTranscoding(platform, tvShowUrl, tvShowFile, outputPath, ExecConfig);
                }
            }

            var tvShowInfo = {
                'platform': platform,
                'duration': tvShowDuration,
                'progression': tvShowProgression
            }

            response.json(tvShowInfo);

        });
	});
};

/* Private Methods */

GettvShowDurarion = function(response, tvShowUrl, tvShowFile, platform, callback) {
	var probe = require('node-ffprobe');
	probe(tvShowUrl, function(err, probeData) {
        if(!err){
            if(probeData !== undefined || probeData.streams[0].duration !== 0 && probeData.streams[0].duration !== undefined && probeData.streams[0].duration !== "N/A" ){
                console.log('Metadata found, continuing...');
                var data = probeData.streams[0].duration;
                callback(data);
            } else {
                console.log('Falling back to IMDB runtime information' .blue);
                getDurationFromDatabase(tvShowFile, platform, function(data){
                    if(data !== null){
                        callback(data);
                    } else{
                        console.log('Unknown tvShow duration, falling back to estimated duration.' .red);
                        var data = 9000;
                        callback(data);
                    }
                });

            }
        }else {
            console.log('Using fallback length due to error: ',err);
            var data = 9000;
            callback(data);
        }
	});

};

getDurationFromDatabase = function(tvShowFile, platform, callback) {
	var original_title =  tvShowFile.replace(/(avi|mkv|mpeg|mpg|mov|mp4|wmv)$/,"")

	db.query('SELECT * FROM tvshows WHERE title =? ', [ original_title ], {
			local_name 		: String,
			title           : String,
			banner  	    : String,
			genre           : String,
			certification   : String
		},
		function(rows) {
			if (typeof rows !== 'undefined' && rows.length > 0){
				var runtime = parseInt(rows[0].runtime) * 60;
				console.log('Runtime found', rows[0].runtime);
				var data = runtime;
                callback(data);
			} else {
				callback(null);
			}
		}
	);
}

checkProgression = function(tvShowFile, callback) {
    db.query('SELECT * FROM progressionmarker WHERE title =? ', [ tvShowFile ], {
            tvShowtitle 		: String,
            progression     : String
        },
        function(rows) {
            if (typeof rows !== 'undefined' && rows.length > 0){
                var data = {
                       'progression':rows[0].progression,
                       'transcodingstatus':rows[0].transcodingstatus
                };
                callback(data);
            } else {
                var data = {
                    'progression':0,
                    'transcodingstatus':'pending'
                }
                callback(data);
            }
        }
    );
}


startTranscoding = function(platform, tvShowUrl, tvShowFile, outputPath, ExecConfig){

    var ffmpeg = 'ffmpeg -i "'+tvShowUrl+'" -g 52 -threads 0 -vcodec libx264 -coder 0 -flags -loop -pix_fmt yuv420p -crf 22 -subq 0 -sc_threshold 0 -s 1280x720 -profile:v baseline -keyint_min 150 -deinterlace -maxrate 10000000 -bufsize 10000000 -b 1200k -acodec aac -ar 48000 -ab 192k -strict experimental -movflags +frag_keyframe+empty_moov '+outputPath
    var exec = require('child_process').exec
    , child = exec(ffmpeg, ExecConfig, function(err, stdout, stderr) {
        if (err) {
            console.log('FFMPEG error: ',err) ;
        } else{
            console.log('Transcoding complete');

            db.query('UPDATE progressionmarker SET transcodingstatus = "done" WHERE tvShowtitle =? ', [ tvShowFile ]);
        }
    });

    child.stdout.on('data', function(data) { console.log(data.toString()); });
    child.stderr.on('data', function(data) { console.log(data.toString()); });
}