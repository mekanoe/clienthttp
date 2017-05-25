/*
  clienthttp is a polyfill of the WHATWG Fetch API.

  These are safe to run in parallel. If you need to run ten http requests,
  all 10 will resolve in a timely manner.

  You **can** put clienthttp.cs in it's own resource, and make it async if you believe it will improve things.
  I already do async functions on it, so... good luck.

  See https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch

  This only supports TEXT and JSON. If you do something else, this library cannot guarantee it'll work.
  For special cases, use other tools with the TEXT output.

  A quick example

    fetch("https://world.gta.libertyrp.net/economy/").then((response) => {
        return response.json()
    }).then((body) => {
        updateEconomyUI(body.economy_data)
    }).catch((err) => {
        handleError(err)
    })

    fetch("https://world.gta.libertyrp.net/economy/bank", {
        method: 'POST',
        body: JSON.stringify({
            action: 'deposit',
            amount: 100000
        })
    }).then((response) => {
        if (response.status !== 200) {
            throw new Error(response.statusText)
        }
    })//...

  -- Implementation details:
  Since client-side JS doesn't have access to any HTTP clients, we asynchronously tell the server to do so.
  Client generates a long random token
  Client sends a serverEventTrigger("clienthttp/request", token, JSON Request), returns a Promise
  Server recieves, does the request.
  Server request finishes, sends serverEventTrigger("clienthttp/respose", token, JSON Response)
  Client recieves, resolves promise.
*/

/// ////////////////////////////////////////////////
/// SERVER-SIDE COMMS
/// ////////////////////////////////////////////////
/// //////////////////////

const __requests = {}

API.onServerEventTrigger.connect((name, args) => {
  if (name === 'clienthttp/response') {
    // // API.sendChatMessage(API.toJson(args))

    const token = args[0]
    const status = args[1]
    const headers = args[2]
    const body = args[3]
    let error = false

    if (args.length === 5) {
      error = args[4]
    }

    // API.sendChatMessage('got http event: '+token)

    if (__requests[token] === undefined) {
      throw new TypeError('server responded to a request that does not exist')
    }

    const req = __requests[token]

    if (error) {
      return req.reject(new TypeError(body))
    }

    return req.resolve({status, body, headers: JSON.parse(headers)})
  }
})

function generateToken () {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''

  for (let i = 0; i < 32; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)) }

  return text
}

class ServerRequest {
  constructor (req) {
    this.data = {
      body: req._serverbody(),
      url: req.url,
      credentials: req.credentials,
      headers: req.headers.map,
      method: req.method,
      mode: req.mode,
      referrer: req.referrer
    }
    // API.sendChatMessage('created http event: '+this.url)
  }

  run () {
    return new Promise((resolve, reject) => {
      const token = generateToken()
      __requests[token] = {
        resolve, reject
      }

      API.triggerServerEvent('clienthttp/request', token, JSON.stringify(this.data))
      // API.sendChatMessage('triggered http event: '+token)
    })
  }
}

/// ////////////////////////////////////////////////
/// FETCH API POLYFILL
/// ////////////////////////////////////////////////
/// //////////////////////

const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
const redirectStatuses = [301, 302, 303, 307, 308]

function normalizeMethod (method) {
  var upcased = method.toUpperCase()
  return (methods.indexOf(upcased) > -1) ? upcased : method
}
function normalizeName (name) {
  if (typeof name !== 'string') {
    name = '' + name
  }
  if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(name)) {
    throw new TypeError('Invalid character in header field name')
  }
  return name.toLowerCase()
}

function normalizeValue (value) {
  if (typeof value !== 'string') {
    value = '' + value
  }
  return value
}

// Build a destructive iterator for the value list
function iteratorFor (items) {
  var iterator = {
    next: function () {
      var value = items.shift()
      return {done: value === undefined, value: value}
    }
  }

  iterator[Symbol.iterator] = function () {
    return iterator
  }

  return iterator
}

class Headers {
  constructor (headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function (value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function (header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function (name) {
        this.append(name, headers[name])
      }, this)
    }

    this[Symbol.iterator] = this.entries
  }

  append (name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue + ',' + value : value
  }

  delete (name) {
    delete this.map[normalizeName(name)]
  }

  get (name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  has (name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  set (name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  forEach (callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  keys () {
    var items = []
    this.forEach(function (value, name) { items.push(name) })
    return iteratorFor(items)
  }

  values () {
    var items = []
    this.forEach(function (value) { items.push(value) })
    return iteratorFor(items)
  }

  entries () {
    var items = []
    this.forEach(function (value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }
}

class Request {
  constructor (input, options = {}) {
    let body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
  }

  clone () {
    return new Request(this)
  }

  _serverbody () {
    this.body = this.body
    this.bodyUsed = true
    return this.body
  }

  _requestobj () {

  }
}

class Response {
  constructor (response) { //
    // API.sendChatMessage('in response')
    this.type = 'default'
    this.status = 'status' in response ? response.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in response ? response.statusText : 'OK'
    try {
      this.headers = new Headers(response.headers)
    } catch (e) {
      // API.sendChatMessage(`~r~ERR:~w~ ${e.stack}`)
    }
    this.url = response.url || ''
    this.body = response.body

    this._response = response
  }

  text () {
    return Promise.resolve(this.body)
  }

  json () {
    return this.text().then((t) => {
      return Object.assign({}, JSON.parse(t))
    })
  }

  clone () {
    return new Response(this._response, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  error () {
    const response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  redirect (url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }
}

function fetch (input, init) {
  return new Promise((resolve, reject) => {
    // API.sendChatMessage('in fetch')

    try {
      const request = new Request(input, init)
      // API.sendChatMessage('got request')

      const srvreq = new ServerRequest(request)
      // API.sendChatMessage('got srvreq')

      srvreq.run().then((data) => {
        resolve(new Response(data))
        // API.sendChatMessage('in response postresolve')
      }).catch((err) => {
        return reject(new TypeError('Network request failed', err))
      })
    } catch (e) {
      // API.sendChatMessage(`~r~ERR:~w~ ${e.stack}`)
    }
  })
}

function cefloader () {
  return fetch
}

function __requireExports () { // eslint-disable-line no-unused-vars
  return {
    fetch,
    cefloader
  }
}
