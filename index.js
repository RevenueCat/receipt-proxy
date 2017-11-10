var http = require('http');
var httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({
  secure: false
});

var server = http.createServer(function(req, res) {
  var target = (req.url !== "/sandbox") ? "https://buy.itunes.apple.com/verifyReceipt" 
                                        : "https://sandbox.itunes.apple.com/verifyReceipt";
  proxy.web(req, res, { target: target, ignorePath: true });

  res.setHeader('Access-Control-Allow-Origin', 'www.revenuecat.com');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if ( req.method === 'OPTIONS' ) {
    res.writeHead(200);
    res.end();
    return;
  }
});

server.listen(process.env.PORT);