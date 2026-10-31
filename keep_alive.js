var http = require('http');

// Small web server so uptime pingers can keep free hosts awake
http.createServer(function (req, res) {
  res.write("I'm alive");
  res.end();
}).on('error', function (err) {
  console.error('Keep-alive server not started: ' + err.message);
}).listen(process.env.PORT || 8080);
