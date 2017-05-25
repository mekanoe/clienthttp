# clienthttp / fetch API for gta: network

"this is magic" - Nvw 2017

this resource provides a client-side code HTTP client for GTA: Network.

this does *not* supply you with an HTTP client on the server. use included C# tools. you may use this resource as a weak reference for doing this, though.

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## Installing

0. **your game server must be running .NET 4.5 or newer.**

1. clone this repo into your server's `resources` folder.

2. add `<resource src="clienthttp" />` to your settings.xml

3. optionally install [require](https://github.com/kayteh/require) (it's cool, i swear!)

4. done!

## Using

This closely, but not perfectly, follows the [WHATWG Fetch API spec](https://fetch.spec.whatwg.org/#fetch-method). There's not a lot to cover that other widely-available documentation sources already don't.

All of the documentation on how to use this function is here: <https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch>

### Example, using [require](https://github.com/kayteh/require)

```js
let fetch

API.onResourceStart.connect(() => {
	const { require } = exported.require.require

	fetch = require('clienthttp').fetch

	fetch('https://httpbin.org/user-agent').then((response) => {
		return response.json()
	}).then((data) => {
		API.sendChatMessage(`The your user agent is ${data['user-agent']}`)
	})
})
```

### Example, without require
```js
let fetch

API.onResourceStart.connect(() => {
	fetch = exported.clienthttp.clienthttp.fetch

	fetch('https://httpbin.org/user-agent').then((response) => {
		return response.json()
	}).then((data) => {
		API.sendChatMessage(`The your user agent is ${data['user-agent']}`)
	})
})
```

### Local-mode CEF example

*soon*

## Caveats

This resource only allows you to receive **text** or **json** data. 

If you need XML, or any other, you can open a PR or write a conversion library from `Response.text()`. This is literally what the JSON return does.