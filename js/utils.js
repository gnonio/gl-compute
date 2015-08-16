
function loadFile( url, callback, args ) {
	// Set up an asynchronous request
	var request = new XMLHttpRequest();
	var preventCaching = "?timestamp=" + new Date().getTime()
	request.open('GET', url + preventCaching, true);
	request.setRequestHeader('Cache-Control', 'no-cache');
	request.overrideMimeType('text/plain');

	// Hook the event that gets called as the request progresses
	request.onreadystatechange = function () {
		// If the request is "DONE" (completed or failed)
		if (request.readyState == 4) {
			// If we got HTTP status 200 (OK)
			if (request.status == 200) {
				//var args = [];
				//console.log(args);
				args.push(request)
				callback.apply(null, args);
			} else { // Failed
				throw "Failed to retrieve URL: "+ url;
			}
		}
	};
	request.send(null);
}


// http://dev.housetrip.com/2014/09/15/decoupling-javascript-apps-using-pub-sub-pattern/
// Publish/Subscribe pattern for deferred function callback (adapted)
var	EventQueue = function() {
	this.events = {};
}

EventQueue.prototype = {
	register: function(event, callback, args, count ) {
		console.log(event + " queue registered");
		// create the event if not yet created
		if(!this.events[event]) this.events[event] = [];

		// add the callback
		// Fast events require a preset counter else they never get to increment
		// explore the definition of finish condition on at register phase: console.log( eval("count == 3") );
		var execute = [];
		execute.push(callback);
		for ( var i = 0; i < args.length; i++ ) execute.push(args[i]);
		
		//console.log(callback, args);
		this.events[event].count = count;
		this.events[event].push( callback == null ? function(){} : execute );
	},
	submit: function(event, data) {
		console.log(event + " event submitted: " + data);
		// return if the event doesn't exist, or there are no listeners
		//if(!this.events[event] || this.events[event].length < 1) return;

		this.events[event].count--;
		if (this.events[event].count == 0) { this.finished( event, data ) }

		// send the event to all listeners
		/*this.events[event].forEach(function(callback) {
		/*this.events[event].forEach(function(callback) {
			//callback(data || {} );
			//callback( data[0]( data[1] ) || {} );
		});*/
	},
	finished: function(event, data ) {
		console.log(event + " finished -> executing callback()\n\r" );
		var fn = this.events[event][this.events[event].length-1][0];
		var args = [];
		for ( var i = 1; i < this.events[event][this.events[event].length-1].length; i++ ) args.push(this.events[event][this.events[event].length-1][i]);
		fn.apply(null, args);
		// empty queue
		delete this.events[event];
	}
}