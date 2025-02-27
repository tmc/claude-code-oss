// proxySetup.mjs
import { createRequire } from 'node:module';
import { bootstrap } from 'global-agent';
import http from 'node:http';
import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';


// set NODE_TLS_REJECT_UNAUTHORIZED:
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Patch immediately
function configureProxy() {
  console.log('[PROXY DEBUG] Starting proxy configuration from proxySetup.mjs');

  // Set up proxy environment variables
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  const proxy = httpsProxy || 'http://127.0.0.1:9090';
  const proxyAgent = new HttpsProxyAgent(proxy);

  // Force global-agent settings
  process.env.GLOBAL_AGENT_FORCE_GLOBAL_AGENT = 'true';
  if (httpProxy) process.env.GLOBAL_AGENT_HTTP_PROXY = httpProxy;
  if (httpsProxy) process.env.GLOBAL_AGENT_HTTPS_PROXY = httpsProxy;
  if (noProxy) process.env.GLOBAL_AGENT_NO_PROXY = noProxy;

  // Patch CommonJS https module (used by f41 via B1)
  const require = createRequire(import.meta.url);
  const commonJsHttps = require('https');
  const originalHttpRequest = http.request;
  const originalCommonJsHttpsRequest = commonJsHttps.request;

  http.request = function (...args) {
    const [options] = args;
    const url = typeof options === 'string' ? options :
                (options.href || `${options.protocol || 'http:'}//${options.hostname || options.host || ''}:${options.port || '80'}${options.path || '/'}`);
    console.log(`[PROXY DEBUG] HTTP Request: ${url}`);

    if (typeof options === 'object' && options.headers) {
      const safeHeaders = { ...options.headers };
      delete safeHeaders.authorization;
      delete safeHeaders.Authorization;
      console.log(`[PROXY DEBUG] HTTP Headers:`, safeHeaders);
    }

    const req = originalHttpRequest.apply(this, args);
    req.on('response', (res) => {
      console.log(`[PROXY DEBUG] HTTP Response: ${res.statusCode} for ${url}`);
    });
    req.on('error', (err) => {
      console.error(`[PROXY DEBUG] HTTP Error: ${err.message} for ${url}`);
    });
    return req;
  };

  commonJsHttps.request = function (...args) {
    console.log("[PROXY DEBUG] in CommonJS https.request");
    const [options] = args;
    const url = typeof options === 'string' ? options :
                (options.href || `${options.protocol || 'https:'}//${options.hostname || options.host || ''}:${options.port || '443'}${options.path || '/'}`);
    console.log(`[PROXY DEBUG] HTTPS Request: ${url}`);

    if (url.includes('anthropic.com')) {
      console.log('[PROXY DEBUG] Anthropic API HTTPS request detected');
      console.log('[PROXY DEBUG] HTTPS request stack:', new Error().stack);
      options.agent = proxyAgent;
    }

    if (typeof options === 'object' && options.headers) {
      const safeHeaders = { ...options.headers };
      delete safeHeaders.authorization;
      delete safeHeaders.Authorization;
      console.log(`[PROXY DEBUG] HTTPS Headers:`, safeHeaders);
    }

    const req = originalCommonJsHttpsRequest.apply(this, args);
    req.on('response', (res) => {
      console.log(`[PROXY DEBUG] HTTPS Response: ${res.statusCode} for ${url}`);
    });
    req.on('error', (err) => {
      console.error(`[PROXY DEBUG] HTTPS Error: ${err.message} for ${url}, code: ${err.code}, errno: ${err.errno || 'N/A'}`);
      console.error('[PROXY DEBUG] Request error stack:', err.stack);
      if (err.code === 'EBADF') {
        console.error('[PROXY DEBUG] EBADF error during HTTPS request to:', url);
        console.error('[PROXY DEBUG] Error context:', {
          proxyEnv: {
            HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy,
            HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy,
            GLOBAL_AGENT_FORCE_GLOBAL_AGENT: process.env.GLOBAL_AGENT_FORCE_GLOBAL_AGENT,
            GLOBAL_AGENT_FORCE_PROXY: process.env.GLOBAL_AGENT_FORCE_PROXY
          }
        });
      }
    });
    return req;
  };

  // Bootstrap global-agent
  try {
    console.log('[PROXY DEBUG] Calling bootstrap() from global-agent');
    bootstrap();
    console.log('[PROXY DEBUG] bootstrap() completed successfully');
  } catch (error) {
    console.error('[PROXY DEBUG] Error in bootstrap():', error);
  }

  console.log('[PROXY DEBUG] Proxy configuration completed');
}

// Execute immediately
configureProxy();
