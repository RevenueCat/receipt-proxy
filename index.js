var http = require('http');
var httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({
  secure: false
});

var server = http.createServer(function(req, res) {
  var target = (req.url !== "/sandbox") ? "https://buy.itunes.apple.com/verifyReceipt" 
                                        : "https://sandbox.itunes.apple.com/verifyReceipt";
  proxy.web(req, res, { target: target, ignorePath: true });
});

server.listen(process.env.PORT);