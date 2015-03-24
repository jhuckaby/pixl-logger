// Generic Logger Class for Node.JS
// Copyright (c) 2012, 2014, 2015 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var Class = require("pixl-class");

module.exports = Class.create({
	
	__construct: function(path, columns, args) {
		// create new logger instance
		this.path = path;
		this.columns = columns;
		
		this.args = args || {};
		this.args.pid = process.pid;
		this.args.debugLevel = 1;
		
		if (!this.args.hostname) {
			this.args.hostname = '';
		}
	},

	get: function(key) {
		// get one arg, or all of them
		return key ? this.args[key] : this.args;
	},

	set: function() {
		// set one or more args, pass in key,value or args obj
		if (arguments.length == 2) {
			this.args[ arguments[0] ] = arguments[1];
		}
		else if (arguments.length == 1) {
			for (var key in arguments[0]) this.args[key] = arguments[0][key];
		}
	},

	print: function(args) {
		// setup date/time stuff
		var now = args.now ? args.now : new Date();
		delete args.now;
		var dargs = get_date_args(now);
		
		// import args into object
		for (var key in args) this.args[key] = args[key];
		
		// set automatic column values
		this.args.hires_epoch = now.getTime() / 1000;
		this.args.epoch = Math.floor( this.args.hires_epoch );
		this.args.date = dargs.yyyy + '-' + dargs.mm + '-' + dargs.dd + ' ' + dargs.hh + ':' + dargs.mi + ':' + dargs.ss;
		
		// support json 'data' arg
		if (this.args.data) {
			if (typeof(this.args.data) == 'object') {
				this.args.data = JSON.stringify( this.args.data );
			}
		}
		else this.args.data = '';
		
		// populate columns
		var cols = [];
		for (var idx = 0, len = this.columns.length; idx < len; idx++) {
			var col = this.columns[idx];
			var val = this.args[col];
			if (typeof(val) == 'undefined') val = '';
			cols.push( val.toString().replace(/[\r\n]/g, ' ').replace(/\]\[/g, '') );
		}
		
		// compose log row
		var line = '[' + cols.join('][') + "]\n";
		this.lastRow = line;
		
		// append to log
		fs.appendFile(this.path, line);
		
		// echo to console if desired
		if (this.args.echo) process.stdout.write(line);
	},

	debug: function(level, msg, data) {
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
	},

	error: function(code, msg, data) {
		// simple error log implementation, expects 'code' and 'msg' named columns in log
		this.print({ 
			category: 'error', 
			code: code, 
			msg: msg, 
			data: data 
		});
	},

	transaction: function(code, msg, data) {
		// simple debug log implementation, expects 'code' and 'msg' named columns in log
		this.print({ 
			category: 'transaction', 
			code: code, 
			msg: msg, 
			data: data 
		});
	}

});

function get_date_args(thingy) {
	// return hash containing year, mon, mday, hour, min, sec
	// given epoch seconds
	var date = thingy.getFullYear ? thingy : (new Date( thingy * 1000 ));
	var args = {
		year: date.getFullYear(),
		mon: date.getMonth() + 1,
		mday: date.getDate(),
		hour: date.getHours(),
		min: date.getMinutes(),
		sec: date.getSeconds(),
		msec: date.getMilliseconds()
	};

	args.yyyy = args.year;
	if (args.mon < 10) args.mm = "0" + args.mon; else args.mm = args.mon;
	if (args.mday < 10) args.dd = "0" + args.mday; else args.dd = args.mday;
	if (args.hour < 10) args.hh = "0" + args.hour; else args.hh = args.hour;
	if (args.min < 10) args.mi = "0" + args.min; else args.mi = args.min;
	if (args.sec < 10) args.ss = "0" + args.sec; else args.ss = args.sec;

	if (args.hour >= 12) {
		args.ampm = 'pm';
		args.hour12 = args.hour - 12;
		if (!args.hour12) args.hour12 = 12;
	}
	else {
		args.ampm = 'am';
		args.hour12 = args.hour;
		if (!args.hour12) args.hour12 = 12;
	}
	return args;
};
