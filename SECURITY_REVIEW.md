# Security Review — receipt_proxy

**Date:** 2026-05-11  
**Branch:** master  
**Scan type:** At-rest cron scan

## Finding Summary

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| 1 | HIGH | `index.js:4-6` | TLS certificate verification disabled on upstream connections |
| 2 | MEDIUM | `index.js:8-22` | Unauthenticated open proxy with wildcard CORS |

---

## Finding 1: TLS Certificate Verification Disabled

**Severity:** HIGH  
**Location:** `index.js:4-6`  
**Verified:** Yes

### Description

The proxy is created with `secure: false`, which disables TLS certificate verification on all upstream connections to Apple's `verifyReceipt` endpoints. This makes the proxy vulnerable to man-in-the-middle (MITM) attacks on the connection between the proxy server and Apple's servers.

### Impact

An attacker who can position themselves on the network path between this proxy and Apple (e.g., same cloud VPC, compromised DNS, BGP hijacking, or rogue infrastructure) can:

1. **Forge receipt validation responses** — returning "valid" for any receipt, enabling unauthorized access to paid in-app purchases and subscriptions without payment.
2. **Intercept receipt data** — capturing receipt payloads which may contain purchase history and account identifiers.

This directly undermines the primary security function of this service (validating that purchases are legitimate).

### Attack Path

1. Attacker positions themselves on the network between this proxy and `buy.itunes.apple.com` or `sandbox.itunes.apple.com` (e.g., ARP spoofing in the same network, DNS poisoning, or compromised intermediate infrastructure).
2. Attacker presents a self-signed or invalid TLS certificate for the Apple domain.
3. Because `secure: false` is set, the proxy accepts the invalid certificate without error.
4. Attacker intercepts the receipt validation request and returns a forged response with `{"status": 0}` (indicating a valid receipt).
5. The client application receives the forged "valid" response and grants access to paid content.

### Evidence

```javascript
// index.js:4-6
var proxy = httpProxy.createProxyServer({
  secure: false  // Disables SSL certificate verification
});
```

### Remediation

Remove `secure: false` or set it to `true` (the default). If there are certificate chain issues in the deployment environment, fix the CA certificate bundle rather than disabling verification:

```javascript
var proxy = httpProxy.createProxyServer({
  secure: true  // Verify upstream TLS certificates (default)
});
```

---

## Finding 2: Unauthenticated Open Proxy with Wildcard CORS

**Severity:** MEDIUM  
**Location:** `index.js:8-22`  
**Verified:** Yes

### Description

The proxy server has no authentication mechanism and sets `Access-Control-Allow-Origin: '*'`, allowing any client on the internet — including any website via browser-based requests — to use this proxy to validate receipts against Apple's servers.

### Impact

- **Abuse as an open relay:** Any attacker can use this proxy anonymously to validate receipts, potentially exhausting rate limits or service quotas on Apple's API.
- **Cross-origin abuse:** Any malicious website can make cross-origin requests through this proxy via the browser, using it as an oracle for receipt validation without requiring server-side infrastructure.
- **Information disclosure:** Receipt validation responses may reveal whether a specific receipt is valid, which could be used for reconnaissance or fraud detection evasion.

### Attack Path

1. Attacker discovers the public URL of this proxy (e.g., via Heroku app enumeration, given the Procfile).
2. Attacker sends arbitrary receipt data to the proxy without any authentication.
3. The proxy forwards it to Apple and returns the validation result.
4. Attacker uses this to validate stolen/shared receipts or to probe Apple's validation API without direct access.

### Evidence

```javascript
// index.js:8-13
var server = http.createServer(function(req, res) {
  // No authentication check before proxying
  var target = (req.url !== "/sandbox") ? "https://buy.itunes.apple.com/verifyReceipt" 
                                        : "https://sandbox.itunes.apple.com/verifyReceipt";
  proxy.web(req, res, { target: target, ignorePath: true, changeOrigin: true });

  res.setHeader('Access-Control-Allow-Origin', '*');  // Allows any origin
```

### Remediation

1. Add authentication (e.g., API key or shared secret in a header):

```javascript
var server = http.createServer(function(req, res) {
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }
  // ... proxy logic
});
```

2. Restrict CORS to known origins:

```javascript
var allowedOrigins = ['https://your-app.example.com'];
var origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```
