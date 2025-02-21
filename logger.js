// Generic Logger Class for Node.JS
// Copyright (c) 2012 - 2021 Joseph Huckaby and PixlCore.com
// Released under the MIT License

const fs = require('fs');
const zlib = require('zlib');
const Path = require('path');
const os = require('os');
const chalk = require('chalk');
const whenever = require('approximate-now');
const Uncatch = require('uncatch');

const Class = require("class-plus");
const Tools = require("pixl-tools");

const async = Tools.async;
const mkdirp = Tools.mkdirp;
const glob = Tools.glob;

module.exports = Class({
	
	__events: true,
	
	columnColors: ['gray', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'],
	dividerColor: 'dim',
	
	internalArgs: ['pather', 'filter', 'serializer', 'echoer', 'useBuffer', 'bufferMaxLines', 'flushInterval', 'flushOnShutdown', 'approximateTime'],
	
	pather: null,
	filter: null,
	serializer: null,
	echoer: null,
	
	useBuffer: false,
	bufferMaxLines: 100,
	flushInterval: 100,
	flushOnShutdown: true,
	approximateTime: false
	
},
class Logger {
	
	constructor(path, columns, args) {
		// create new logger instance
		var self = this;
		
		this.path = path;
		this.columns = columns;
		this.args = args ? Tools.copyHash(args, true) : {};
		
		if (!this.args.debugLevel) this.args.debugLevel = 1;
		if (!this.args.hostname) {
			this.args.hostname = os.hostname().toLowerCase();
		}
		if (!this.args.pid) this.args.pid = process.pid;
		
		// pass hooks in args
		this.internalArgs.forEach( function(key) {
			if (self.args[key]) {
				self[key] = self.args[key];
				delete self.args[key];
			}
		});
		
		// setup buffer system
		if (this.useBuffer) this.enableBuffer();
	}
	
	enableBuffer() {
		// setup flush interval
		this.useBuffer = true;
		this.bufferLines = [];
		this.flushTimer = setInterval( this.flushBuffer.bind(this), this.flushInterval );
		
		if (this.flushOnShutdown) {
			process.on('SIGTERM', this.shutdown.bind(this));
			process.on('SIGINT', this.shutdown.bind(this));
			process.on('SIGQUIT', this.shutdown.bind(this));
			Uncatch.on('uncaughtException', this.shutdown.bind(this));
		}
	}
	
	bufferAppendLine(line) {
		// append line to buffer, flush if full
		this.bufferLines.push(line);
		if (this.bufferLines.length >= this.bufferMaxLines) this.flushBuffer();
	}
	
	flushBuffer() {
		// flush all buffered lines to disk
		// only allow one libuv I/O thread at a time
		// if FS is busy, buffer continues to grow, and will flush on next print or flush interval
		var self = this;
		if (!this.useBuffer || !this.bufferLines.length || this.flushInProgress) return;
		this.flushInProgress = true;
		
		var payload = this.bufferLines.join("");
		this.bufferLines = [];
		
		if (this.args.sync) {
			fs.appendFileSync( this.lastPath, payload );
			this.flushInProgress = false;
			this.emit('bufferFlushed', payload);
		}
		else {
			fs.appendFile( this.lastPath, payload, function() {
				self.flushInProgress = false;
				self.emit('bufferFlushed', payload);
			});
		}
	}
	
	shutdown() {
		// shut down buffer and disable async too (called on shutdown / crash)
		if (!this.useBuffer) return;
		
		if (this.flushTimer) {
			clearInterval( this.flushTimer );
			delete this.flushTimer;
		}
		
		// force shutdown flush in sync mode
		if (this.bufferLines.length) {
			fs.appendFileSync( this.lastPath, this.bufferLines.join("") );
			this.bufferLines = [];
		}
		
		this.useBuffer = false;
		this.args.sync = true;
	}
	
	get(key) {
		// get one arg, or all of them
		return key ? this.args[key] : this.args;
	}
	
	set() {
		// set one or more args, pass in key,value or args obj
		if (arguments.length == 2) {
			if (arguments[0].toString().match(/^(pather|filter|serializer|echoer|useBuffer|bufferMaxLines|flushInterval|flushOnShutdown)$/)) {
				this[arguments[0]] = arguments[1];
			}
			else this.args[ arguments[0] ] = arguments[1];
		}
		else if (arguments.length == 1) {
			for (var key in arguments[0]) this.set(key, arguments[0][key]);
		}
	}
	
	clone(args) {
		// make copy of ourself with optional overrides
		var self = this;
		var clone = new module.exports( this.path, this.columns, this.args );
		
		this.internalArgs.forEach( function(key) {
			if (self[key]) clone[key] = self[key];
		});
		
		if (args) clone.set(args);
		
		return clone;
	}
	
	print(in_args) {
		// setup date/time stuff
		
		// copy args object, never modify user object
		var args = Tools.copyHash(in_args);
		
		var now = 0;
		if (args.now) {
			// now was passed in (expects hires-epoch)
			now = args.now * 1000;
			delete args.now;
		}
		else if (this.approximateTime) {
			// use approximate-time (~50ms precision)
			now = whenever.approximateTime.now;
		}
		else {
			// call system time
			now = Date.now();
		}
		
		var hires_epoch = now / 1000;
		var epoch = Math.floor( hires_epoch );
		
		// only compute local date/time string for unique seconds, for performance
		var date_str = '';
		if (this.lastEpoch && (epoch == this.lastEpoch)) {
			date_str = this.lastDateStr;
		}
		else {
			date_str = Tools.formatDate( epoch, '[yyyy]-[mm]-[dd] [hh]:[mi]:[ss]' );
			this.lastDateStr = date_str;
			this.lastEpoch = epoch;
		}
		
		// import args into object
		for (var key in this.args) {
			if (!(key in args)) args[key] = this.args[key];
		}
		
		// set automatic column values
		args.hires_epoch = hires_epoch;
		args.epoch = epoch;
		args.date = date_str;
		
		// populate columns
		var cols = [];
		for (var idx = 0, len = this.columns.length; idx < len; idx++) {
			var col = this.columns[idx];
			var val = args[col];
			
			if ((typeof(val) == 'undefined') || (val === null) || !val.toString) val = '';
			
			if (this.filter) {
				cols.push( this.filter(val, idx) );
			}
			else {
				if (typeof(val) == 'object') val = JSON.stringify(val);
				cols.push( val.toString().replace(/[\r\n]/g, ' ').replace(/\]\[/g, '') );
			}
		}
		
		// compose log row
		var line = this.serializer ? this.serializer(cols, args) : ('[' + cols.join('][') + "]" + os.EOL);
		if (line === false) return; // do not log anything
		this.lastRow = line;
		
		// file path may have placeholders, expand these if necessary
		var path = this.path;
		if (this.pather) {
			path = this.pather( path, args );
		}
		else if (path.indexOf('[') > -1) {
			path = Tools.substitute( path, args );
		}
		this.lastPath = path;
		
		// append to log
		if (this.useBuffer) this.bufferAppendLine(line);
		else if (args.sync) fs.appendFileSync(path, line);
		else fs.appendFile(path, line, function() {});
		
		// echo to console if desired
		if (args.echo) {
			if (this.echoer) {
				if (typeof(this.echoer) == 'function') {
					this.echoer( line, cols, args );
				}
				else if (typeof(this.echoer) == 'string') {
					if (args.sync) fs.appendFileSync(this.echoer, line);
					else fs.appendFile(this.echoer, line, function() {});
				}
			}
			else if (args.color) {
				// print in color (ignores custom serializer)
				process.stdout.write( this.colorize(cols) + os.EOL );
			}
			else {
				// print plain
				process.stdout.write( line );
			}
		}
		
		// emit row as an event
		this.emit( 'row', line, cols, args );
	}
	
	colorize(cols) {
		// colorize one row (bracket format)
		var ccols = [];
		var nclrs = this.columnColors.length;
		var dclr = chalk[ this.dividerColor ];
		
		for (var idx = 0, len = cols.length; idx < len; idx++) {
			ccols.push( chalk[ this.columnColors[idx % nclrs] ]( cols[idx] ) );
		}
		
		return dclr('[') + ccols.join( dclr('][') ) + dclr(']');
	}
	
	debug(level, msg, data) {
		// simple debug log implementation, expects 'code' and 'msg' named columns in log
		// only logs if level is less than or equal to current debugLevel arg
		if (level <= this.args.debugLevel) {
			this.print({ 
				category: 'debug', 
				code: level, 
				msg: msg, 
				data: data 
			});
		}
	}
	
	error(code, msg, data) {
		// simple error log implementation, expects 'code' and 'msg' named columns in log
		this.print({ 
			category: 'error', 
			code: code, 
			msg: msg, 
			data: data 
		});
	}
	
	transaction(code, msg, data) {
		// simple debug log implementation, expects 'code' and 'msg' named columns in log
		this.print({ 
			category: 'transaction', 
			code: code, 
			msg: msg, 
			data: data 
		});
	}
	
	rotate() {
		// rotate any log file atomically (defaults to our own file)
		// 2 arg convention: dest_path, callback
		// 3 arg convention: log_file, dest_path, callback
		var log_file = '';
		var dest_path = '';
		var callback = null;
		
		if (arguments.length == 3) {
			log_file = arguments[0];
			dest_path = arguments[1];
			callback = arguments[2];
		}
		else if (arguments.length == 2) {
			dest_path = arguments[0];
			callback = arguments[1];
		}
		else throw new Error("Wrong number of arguments to rotate()");
		
		if (!log_file) log_file = this.path;
		if (log_file.indexOf('[') > -1) {
			log_file = Tools.substitute( log_file, this.args );
		}
		
		// if dest path ends with a slash, add src filename + date/time stamp
		if (dest_path.match(/\/$/)) {
			var dargs = Tools.getDateArgs( Tools.timeNow() );
			dest_path += Path.basename(log_file);
			dest_path += '.' + (dargs.yyyy_mm_dd + '-' + dargs.hh_mi_ss).replace(/\W+/g, '-');
			dest_path += '.' + Tools.generateUniqueID(16) + Path.extname(log_file);
		}
		
		// try fs.rename first
		fs.rename(log_file, dest_path, function(err) {
			if (err && (err.code == 'EXDEV')) {
				// dest path crosses fs boundary, gotta rename + copy + rename + delete
				
				// first, perform local rename in source log directory
				var src_temp_file = log_file + '.' + Tools.generateUniqueID(32) + '.tmp';
				fs.rename(log_file, src_temp_file, function(err) {
					if (err) {
						if (callback) callback(err);
						return;
					}
					
					// copy src temp to dest temp file, then rename it
					var dest_temp_file = dest_path + '.' + Tools.generateUniqueID(32) + '.tmp';
					var inp = fs.createReadStream(src_temp_file);
					var outp = fs.createWriteStream(dest_temp_file);
					
					if (callback) inp.on('error', callback );
					if (callback) outp.on('error', callback );
					
					outp.on('finish', function() {
						// final rename
						fs.rename(dest_temp_file, dest_path, function(err) {
							if (err) {
								if (callback) callback(err);
								return;
							}
							
							// all done, delete src temp file
							fs.unlink(src_temp_file, function(err) {
								if (callback) callback(err);
							});
						});
					} );
					
					inp.pipe( outp );
				} ); // src rename
			} // EXDEV
			else {
				// rename worked, or other error
				if (callback) callback(err);
			}
		} ); // fs.rename
	}
	
	archive(src_spec, dest_path, epoch, callback) {
		// archive one or more log files, can use glob spec (defaults to our file).
		// dest path may use placeholders: [yyyy], [mm], [dd], [hh], [filename], [hostname], etc.
		// creates dest dirs as needed.
		// if dest path ends in .gz, archives will be compressed.
		var self = this;
		if (!src_spec) src_spec = this.path;
		if (!callback) callback = function() {};
		
		// fill date/time placeholders
		var dargs = Tools.getDateArgs( epoch );
		for (var key in dargs) self.args[key] = dargs[key];
		
		glob(src_spec, {}, function (err, files) {
			// got files
			if (err) return callback(err);
			
			if (files && files.length) {
				async.eachSeries( files, function(src_file, callback) {
					// foreach file
					
					// add filename to args
					self.args.filename = Path.basename(src_file).replace(/\.\w+$/, '');
					
					// construct final path
					var dest_file = Tools.substitute( dest_path, self.args );
					
					// rename local log first
					var src_temp_file = src_file + '.' + Tools.generateUniqueID(32) + '.tmp';
					
					fs.rename(src_file, src_temp_file, function(err) {
						if (err) {
							return callback( new Error("Failed to rename: " + src_file + " to: " + src_temp_file + ": " + err) );
						}
						
						// create dest dirs as necessary
						mkdirp(Path.dirname(dest_file), function (err) {
							if (err) {
								return callback( new Error("Failed to make directories for: " + dest_file + ": " + err) );
							}
							
							if (dest_file.match(/\.gz$/i)) {
								// gzip the log archive
								var gzip = zlib.createGzip();
								var inp = fs.createReadStream( src_temp_file );
								var outp = fs.createWriteStream( dest_file, {flags: 'a'} );
								
								inp.on('error', callback);
								outp.on('error', callback);
								
								outp.on('finish', function() {
									// all done, delete temp file
									fs.unlink( src_temp_file, callback );
								} );
								
								inp.pipe(gzip).pipe(outp);
							} // gzip
							else {
								// straight copy (no compress)
								var inp = fs.createReadStream( src_temp_file );
								var outp = fs.createWriteStream( dest_file, {flags: 'a'} );
								
								inp.on('error', callback);
								outp.on('error', callback);
								
								outp.on('finish', function() {
									// all done, delete temp file
									fs.unlink( src_temp_file, callback );
								} );
								
								inp.pipe( outp );
							} // copy
						} ); // mkdirp
					} ); // fs.rename
				}, callback ); // eachSeries
			} // got files
			else {
				callback( err || new Error("No files found matching: " + src_spec) );
			}
		} ); // glob
	}
	
	shouldLog(level) {
		// // check if we're logging at or above the requested level
		return( this.get('debugLevel') >= level );
	}

});
