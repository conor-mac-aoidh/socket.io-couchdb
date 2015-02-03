/**
 * Module dependencies.
 */
'use strict';

var uid2 = require('uid2');
var msgpack = require('msgpack-js');
var Adapter = require('socket.io-adapter');
var Emitter = require('events').EventEmitter;
var debug = require('debug')('socket.io-couchdb');
var request = require('request');
var JSONStream = require('JSONStream');
var domain = require('domain');
var http = require('http');
//var nock = require('nock');
var stream = require('stream');
var es = require('event-stream');
//nock.recorder.rec();

/**
 * Returns a redis Adapter class.
 *
 * @param {String} optional, redis uri
 * @return {RedisAdapter} adapter
 * @api public
 */

function adapter(uri, opts){
  opts = opts || {};

  // handle options only
  if ('object' == typeof uri) {
    opts = uri;
    uri = null;
  }
 
  // handle uri string
  if (opts.host && !opts.port) {
    // using basic auth
    if(opts.host.indexOf('@') !== -1){
      opts.host = opts.host.split(':');
      opts.port = opts.host.pop();
      opts.host = opts.host.join(':');
    }
    else{
      opts.host = opts.host.split(':');
      opts.host = opts.host[0];
      opts.port = opts.host[1];
    }
  }

  // opts
  var host = opts.host || '127.0.0.1';
  var db = opts.db;
  var port = Number(opts.port || 5984);
  var prefix = opts.key || 'socket.io';
  var base = host + ':' + port + '/' + db + '/';

  // this server's key
  var uid = uid2(6);
  var key = prefix + '#' + uid;

  /**
   * Adapter constructor.
   *
   * @param {String} namespace name
   * @api public
   */

  function CouchDB(nsp){
    Adapter.call(this, nsp);

    var self = this;

    // setup domain/error catcher
    // for changes listener
    var app = domain.create();
    app.on('error', function(err){
      debug(err);
      this.requestChanges();
    }.bind(this));
    app.run(function(){
      this.requestChanges();
    }.bind(this));
  }
  
  CouchDB.prototype.__proto__ = Adapter.prototype;

  CouchDB.prototype.requestChanges = function(){
    http.get(base + '/_changes?feed=continuous&heartbeat=1000&include_docs=true&since=now', function(feed){
      feed
        .pipe(JSONStream.parse())
        .pipe(new stream.PassThrough({
          objectMode : true
        }))
        .pipe(es.map(this.onmessage.bind(this)));
    }.bind(this));
  };

  CouchDB.prototype.onmessage = function(data, cb){ 
    if(!data.doc || !data.doc.channel){
      return;
    }
    var pieces = data.doc.channel.split('#');
    if(uid === pieces.pop()){
      return debug('ignore same uid');
    }
    var args = msgpack.decode(new Buffer(data.doc.msg, 'hex'));
    debug('message received: ', args);

    if(args[0] && args[0].nsp === undefined){
      debug('arg namespace is undefined');
      args[0].nsp = '/';
    }

    if(!args[0] || args[0].nsp !== this.nsp.name){
      return debug('ignore different namespace: ' + args[0].nsp + ' != ' + this.nsp.name);
    }

    args.push(true);

    this.broadcast.apply(this, args);

    cb();
  };

  CouchDB.prototype.broadcast = function(packet, opts, remote){
    debug('broadcasting data');
    Adapter.prototype.broadcast.call(this, packet, opts);
    // add the message to the db
    if(!remote){
      debug('broadcasting message: ', [packet, opts]);
      var msg = msgpack.encode([packet, opts]).toString('hex');
//      var msg = [packet, opts];
      request({
        url     : base,
        method  : 'POST',
        body    :  {
          channel   : key,
          msg       : msg
        },
        json    : true
      });
    }
  };

  return CouchDB;
}

module.exports = adapter;
