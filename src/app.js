'use strict';

//Requiring modules needed
const express = require('express');
const morgan = require('morgan');
var bodyParser = require('body-parser');
const mongoose = require('mongoose');

//Calling and running express
const app = express();

// set our port
app.set('port', process.env.PORT || 3000);

// morgan gives us http request logging
app.use(morgan('dev'));

// parse incoming requests
app.use(bodyParser.urlencoded({ extended: false }));

// serve static files from /public
app.use(express.static(__dirname + '/public'));

// view engine setup
app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

//Below code connects to Mongo

//Connection URL
const course  = "mongodb://localhost:27017/twitter"

//Connect to mongoDB
mongoose.connect(course);

//Holds the database connection object
const db = mongoose.connection;

//Creates an error handler with the database
db.on('error', console.error.bind(console, 'connection error:'));

//Writes a message to the console once the connection has been opened successfully
db.on('connected', () => console.log('Mongoose default connection open to ' + course));

// include routes
var routes = require('./routes/index');
app.use('/', routes);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('File Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  if (err.url) {
    res.render(err.url, {
      message: err.message,
      error: {}
    });
  } else {
    res.render('layout', {
      user: req.session.userId,
      name: req.session.username,
      message: err.message,
      error: {}
    });
  }
});

// start listening on our port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});
