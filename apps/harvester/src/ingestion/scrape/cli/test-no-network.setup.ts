import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

type AnyFn = (...args: any[]) => any

const original = {
  httpRequest: http.request as AnyFn,
  httpGet: http.get as AnyFn,
  httpsRequest: https.request as AnyFn,
  httpsGet: https.get as AnyFn,
  netConnect: net.connect as AnyFn,
  tlsConnect: tls.connect as AnyFn,
  fetch: globalThis.fetch as AnyFn | undefined,
}

function blockedNetwork(): never {
  throw new Error('Outbound network is disabled for scraper contract tests')
}

;(http.request as AnyFn) = blockedNetwork
;(http.get as AnyFn) = blockedNetwork
;(https.request as AnyFn) = blockedNetwork
;(https.get as AnyFn) = blockedNetwork
;(net.connect as AnyFn) = blockedNetwork
;(tls.connect as AnyFn) = blockedNetwork
if (typeof globalThis.fetch === 'function') {
  globalThis.fetch = (async () => blockedNetwork()) as typeof fetch
}

process.on('exit', () => {
  ;(http.request as AnyFn) = original.httpRequest
  ;(http.get as AnyFn) = original.httpGet
  ;(https.request as AnyFn) = original.httpsRequest
  ;(https.get as AnyFn) = original.httpsGet
  ;(net.connect as AnyFn) = original.netConnect
  ;(tls.connect as AnyFn) = original.tlsConnect
  if (original.fetch) {
    globalThis.fetch = original.fetch as typeof fetch
  }
})
