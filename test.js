// Unit tests for pixl-logger
// Copyright (c) 2021 Joseph Huckaby
// Released under the MIT License

var os = require('os');
var fs = require('fs');
var Path = require('path');
var Tools = require('pixl-tools');
var Logger = require('./logger.js');

process.chdir( __dirname );

var log_file = Path.join( os.tmpdir(), 'pixl-logger-unit-tests.log' );
var log_columns = ['hires_epoch', 'date', 'hostname', 'pid', 'component', 'category', 'code', 'msg', 'data'];

if (fs.existsSync(log_file)) fs.unlinkSync(log_file);

// Unit Tests

module.exports = {
	setUp: function (callback) {
		callback();
	},
	
	beforeEach: function(test) {
		
	},
	
	afterEach: function(test) {
		
	},
	
	onAssertFailure: function(test, msg, data) {
		
	},
	
	tests: [
		
		function testBasicSync(test) {
			var logger = new Logger( log_file, log_columns, { 
				sync: true 
			} );
			
			logger.once('row', function(line, cols, args) {
				test.ok( "Row event fired");
				test.debug( line );
			});
			
			logger.print({
				category: 'debug',
				component: 'main',
				code: 1,
				msg: "Hello log!",
				data: { foo: "bar" }
			});
			
			var payload = fs.readFileSync(log_file, 'utf8');
			
			test.ok( payload.match(/\[main\]\[debug\]\[1\]\[Hello log\!\]\[\{\"foo\"\:\"bar\"\}\]/), "Basic log content not found in file." );
			test.done();
		},
		
		function testBasicAsync(test) {
			var logger = new Logger( log_file, log_columns, {
				sync: false
			} );
			
			logger.print({
				category: 'debug',
				component: 'main',
				code: 1,
				msg: "This was async!"
			});
			
			setTimeout( function() {
				test.ok( fs.readFileSync(log_file, 'utf8').match(/This was async/), "Async log content not found in file." );
				test.done();
			}, 50 );
		},
		
		function testApproxTime(test) {
			if (fs.existsSync(log_file)) fs.unlinkSync(log_file);
			
			var logger = new Logger( log_file, log_columns, {
				sync: false,
				approximateTime: true
			} );
			
			var epochs = [];
			
			logger.on('row', function(line, cols, args) {
				epochs.push( cols[0] );
			});
			
			for (var idx = 0; idx < 10; idx++) {
				logger.print({ category: 'debug', component: 'main', code: 1, msg: "Test" });
			}
			
			test.ok( epochs.length == 10, "Wrong number of rows logged: " + epochs.length );
			
			for (var idx = 1; idx < 10; idx++) {
				test.ok( epochs[idx] > epochs[idx - 1], "Epoch did not increment on sequential print calls." );
			}
			
			test.done();
		},
		
		function testBuffer(test) {
			if (fs.existsSync(log_file)) fs.unlinkSync(log_file);
			
			var logger = new Logger( log_file, log_columns, {
				sync: false,
				useBuffer: true,
				bufferMaxLines: 10,
				flushInterval: 100,
				flushOnShutdown: false
			} );
			
			logger.once('bufferFlushed', function() {
				var lines = fs.readFileSync(log_file, 'utf8').trim().split(/\n/);
				test.ok( lines.length == 10, "Wrong number of lines logged in buffer flush.");
				
				logger.shutdown();
				test.ok( logger.useBuffer === false, "Buffer was not disabled on shutdown.");
				test.ok( logger.args.sync === true, "Sync was not enabled on shutdown.");
				
				test.done();
			});
			
			for (var idx = 0; idx < 10; idx++) {
				logger.print({ category: 'debug', component: 'main', code: 1, msg: "TestBuffer" });
			}
		},
		
		function testBufferIntervalFlush(test) {
			if (fs.existsSync(log_file)) fs.unlinkSync(log_file);
			
			var logger = new Logger( log_file, log_columns, {
				sync: false,
				useBuffer: true,
				bufferMaxLines: 10,
				flushInterval: 100,
				flushOnShutdown: false
			} );
			
			logger.once('bufferFlushed', function() {
				var lines = fs.readFileSync(log_file, 'utf8').trim().split(/\n/);
				test.ok( lines.length == 9, "Wrong number of lines logged in buffer flush.");
				logger.shutdown();
				test.done();
			});
			
			for (var idx = 0; idx < 9; idx++) {
				logger.print({ category: 'debug', component: 'main', code: 1, msg: "TestBuffer" });
			}
		}
		
	],
	
	tearDown: function (callback) {
		// clean up
		if (fs.existsSync(log_file)) fs.unlinkSync(log_file);
		callback();
	}
};
