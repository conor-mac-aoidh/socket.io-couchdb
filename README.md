# socket.io-couchdb

A plugin for socket.io using couchdb as a storage backend. Based on the [socket.io-redis adapter](https://github.com/Automattic/socket.io-redis).

## How to use

```js
var io = require('socket.io')(3000);
var couchdb = require('socket.io-couchdb');
io.adapter(couchdb({ host: 'localhost', port: 5984, db : 'socket.io', encode : true }));
```

By running socket.io with the `socket.io-couchdb` adapter you can run
multiple socket.io instances in different processes or servers that can
all broadcast and emit events to and from each other.

If you need to emit events to socket.io instances from a non-socket.io
process, you should use [socket.io-couchdb-emitter](http:///github.com/conor-mac-aoidh/socket.io-couchdb-emitter).

