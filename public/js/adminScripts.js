var socket = io();

$(document).ready(function() {

	// Identify user
	socket.emit('user', $('#userId').text());

	// Request session information
	socket.emit('getSessions');

});

// Update list of sessions
socket.on('sessionsUpdate', function(msg) {
	$('#sessions').empty();
	for (var key in msg) {
		$('#sessions').append('<div>' + key + " -> " + msg[key] + '</div>');
	}
});

