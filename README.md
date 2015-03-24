# Overview

This module provides a simple logging class, which appends to a text log file with bracket-delimited columns.  You can define any number of columns you want, or use some of the built-in auto-populated columns.  You can populate columns by name, or by using one of the shortcut methods described below.

# Usage

Use [npm](https://www.npmjs.com/) to install the module:

```
	npm install pixl-logger
```

Then use `require()` to load it in your code:

```javascript
	var Logger = require('pixl-logger');
```

To use the module, instantiate an object, and start logging:

```javascript
	var columns = ['hires_epoch', 'date', 'hostname', 'component', 'category', 'code', 'msg', 'data'];
	var logger = new Logger( 'logs/debug.log', columns );
	logger.set('hostname', 'myserver.com');
	
	logger.print({
		category: 'debug',
		component: 'main',
		code: 1,
		msg: "Hello log!"
	});
```

This would append the following like to `logs/debug.log`:

```
	[1423462332.437][2015-02-08 22:12:12][myserver.com][main][debug][1][Hello log!][]
```

Some column names are special, and automatically populated (see below), but the rest are free-form.  You can include any number of columns you like, and name them however you want.

All the log "columns" are basically just key/value pairs stored in an `args` property in the class, which don't have to be specified on every call to `print()`.  Meaning, you can set some of them once, and only have to set them again when they change.  Example:

```javascript
	logger.set('component', 'main');
	logger.set('category', 'debug');
	
	logger.print({
		code: 1,
		msg: "Hello log!"
	});
```

You can also fetch arg values using `get()`.  Pass in a key to fetch one arg, or omit to get the entire `args` object back.

## Data Cleansing

In order to protect the log format and syntax, all column values are "cleansed" before being written.  Specifically, any newlines are converted to single spaces, and the character sequence `][` is stripped (as it would corrupt the log column layout).  All other characters are allowed.  Example:

```javascript
	logger.debug( 1, "This won't go well\n[Hi][There]\r\nGoodbye.\n" );
```

This would be logged as:

```
	[1423466726.159][2015-02-08 23:25:26][myserver.com][main][debug][1][This won't go well [HiThere]  Goodbye. ]
```

## Shortcut Methods

The logger library provides the following three shortcut methods, which accept a list of common arguments instead of a hash:

### debug

The `debug()` method is designed to assist with writing to a debug log.  It automatically sets the `category` column to `debug`.  It requires two arguments, which are values for the `code` (debug level) and `msg` columns, with the 3rd argument being an optional `data` object, if you want.  Examples:

```javascript
	logger.debug( 1, "Logged at debug level 1" );
	logger.debug( 2, "Logged at debug level 2", {some:"data"} );
```

An extra feature with the `debug()` call is that you can set a `debugLevel` arg on your class instance, and it'll only log entries if they have an *equal or lower level* (a.k.a. code).  So imagine this setup:

```javascript
	logger.set( 'debugLevel', 2 );
	
	logger.debug( 1, "Logged at debug level 1" );
	logger.debug( 2, "Logged at debug level 2" );
	logger.debug( 3, "This won't be logged at all!" );
```

In this case we set the `debugLevel` arg to 2, so only the first two calls will be logged.  The third call, which is logged at a higher (more verbose) level than the `debugLevel` value, will be silently skipped.

### error

The `error()` method is designed to assist with logging errors.  It automatically sets the `category` column to `error`.  It requires two arguments, which are values for the `code` and `msg` columns, with the 3rd argument being an optional `data` object, if you want.  Example:

```javascript
	logger.error( 1005, "An error of type 1005 occurred!" );
```

This would be equivalent to calling `print()` with the following:

```javascript
	logger.print({
		category: 'error',
		code: 1005,
		msg: "An error of type 1005 occurred!"
	});
```

### transaction

The `transaction()` method is designed to assist with logging transactions.  A "transaction" is whatever action you define in your app as something you want logged, for audit or replay purposes.  It automatically sets the `category` column to `transaction`.  It requires two arguments, which are values for the `code` and `msg` columns, with the 3rd argument being an optional `data` object, if you want.  Example:

```javascript
	logger.transaction( "user_update", "User jhuckaby was updated", {username:"jhuckaby"} );
```

This would be equivalent to calling `print()` with the following:

```javascript
	logger.print({
		category: 'transaction',
		code: "user_update",
		msg: "User jhuckaby was updated",
		data: {username:"jhuckaby"}
	});
```

## Echo to Console

If you set the `echo` arg to any true value, the logger will echo all log entries to [process.stdout](http://nodejs.org/api/process.html#process_process_stdout), in addition to the log file.  This is useful for running CLI scripts or your app in debug mode.  Example:

```javascript
	logger.set( 'echo', true );
	logger.debug( 1, "This will be logged and echoed to the console!" );
```

## Last Line Logged

To grab the last line logged by the logger, pull the `lastRow` property off the class instance.  It is the fully formatted line, including an EOL.  Example:

```javascript
	var line = logger.lastRow;
```

## Special Column Names

Several column names are special, in that they are automatically populated, or have special behavior.  Here they are:

### epoch

Any column named `epoch` will automatically be populated with the current local server time, represented in integer Epoch seconds.  Example:

```
	[1423433821]
```

### hires_epoch

Any column named `hires_epoch` will automatically be populated with the current local server time, represented in high precision floating point Epoch seconds, with up to 3 digits after the decimal.  Example:

```
	[1423433807.277]
```

### date

Any column named `date` will automatically be populated with a human-friendly version of the current local server time, in `YYYY-MM-DD HH:MI:SS` format.  Example:

```
	[2015-02-08 14:16:58]
```

### pid

Any column named `pid` will automatically be populated with the current Process ID (PID), obtained by calling [process.pid](http://nodejs.org/api/process.html#process_process_pid) once at startup.  Example:

```
	[13702]
```

### data

The `data` column is special, in that if it contains an object, it will be serialized to JSON.  Example:

```
	[{"code":0,"description":"Success"}]
```

### category

The `category` column is only special in that the shortcut methods `debug()`, `error()` and `transaction()` automatically populate it to match their names.

# License

Copyright (c) 2015 Joseph Huckaby

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
