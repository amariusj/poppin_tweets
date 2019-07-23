const express = require('express');
const router = express.Router();
const session = require('express-session');
const auth = require('basic-auth');
const bcrypt = require("bcrypt");
const fetch = require("node-fetch");
const dotenv = require('dotenv');

//Require models
const User = require('../models/user');

dotenv.config();

const twit = require('twitter'),
  twitter = new twit({
    consumer_key: `${process.env.CONSUMER_KEY}`,
    consumer_secret: `${process.env.CONSUMER_SECRET}`,
    access_token_key: `${process.env.ACCESS_TOKEN_KEY}`,
    access_token_secret: `${process.env.ACCESS_TOKEN_SECRET}`
  });

//Uses the session function
router.use(session({
  secret: "mfuen5CLe7nHZsLtATWlCZCSevvKNvGc",
  resave: true,
  saveUninitialized: false
}));

function fetchApi(endpoint) {
  return fetch(endpoint).then(response => response.json());
}

function checkUserAuth(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect('/login');
}

function validateRegisterFields (req, res, next) {
  if (
    req.body.firstName &&
    req.body.lastName &&
    req.body.email &&
    req.body.username &&
    req.body.password &&
    req.body.confirmedpassword
  ) {
    console.log('success');
    return next();
  }
  //If fields weren't filled, then run error
  let err = new Error('All fields are required!');
  err.url = 'register';
  err.status = 400;
  return next(err);
}

function validatePasswordsMatch (req, res, next) {
  if (req.body.password !== req.body.confirmedpassword) {
    let err = new Error('Password must match!');
    err.url = 'register';
    err.status = 400;
    return next(err);
  }
  console.log('success');
  return next();
}

function checkEmail (req, res, next) {

  User.findOne({ email: req.body.email })
  .exec(function (error, user) {

    if (error) {
      return next(error)
    }

    if (user) {
      let err = new Error('Email address already associated with an account');
      err.status = 400;
      err.url = 'register';
      return next(err)
    }
    console.log('success');
    return next();
  });
}

router.use(( async function(req, res, next) {
  let urls = await fetchApi(`http://api.giphy.com/v1/gifs/search?q=funny&limit=12&api_key=dc6zaTOxFJmzC`)
  .then(data => data.data);

  req.session.urls = urls;
  next();
}))

//Renders home page
router.get('/', checkUserAuth, async (req, res, next) => {
  let client = await twitter.get('search/tweets', {q: `funny`, count: 12}, (error, tweets, response) => {
    if (error) {
      error.status = 400;
      error.url = 'home';
      return next(error);
    }
    console.log(tweets);
    return res.render('home', {
      user: req.session.userId,
      name: req.session.username,
      urls: req.session.urls,
      tweets: tweets.statuses
    });
  });
});

//Renders Registration page
router.get('/register', (req, res, next) => {
  res.render('register', {
    user: req.session.userId,
    name: req.session.username
  });
});

//Registers a new user
router.post('/register', validateRegisterFields, validatePasswordsMatch, checkEmail, async (req, res, next) => {

  let userData = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    username: req.body.username,
    password: req.body.password
  }

  User.create(userData, (error, user) => {
    if (error) {
      return next(error);
    } else {
      req.session.userId = user._id;
      req.session.username = user.username.charAt(0).toUpperCase() + user.username.slice(1);
      req.session.lastname = user.lastName;
      res.status(201).redirect('/');
    }
  });
});

//Renders login page
router.get('/login', (req, res, next) => {
  res.render('login', {
    user: req.session.userId,
    name: req.session.username
  });
});

function validateLoginCredentials(req, res, next) {
  if (
    req.body.email &&
    req.body.password
  ) return next();

  let err = new Error('All fields are required!');
  err.url = 'login';
  err.status = 400;
  return next(err);
}

//Logs in a User
router.post('/login', validateLoginCredentials, (req, res, next) => {
  User.findOne({ email: req.body.email })
  .exec(function (error, user) {

    if (error) {
      return next(error)
    }

    if (!user) {
      let err = new Error('No User Found');
      err.status = 400;
      err.url = 'login';
      return next(err)
    }

    bcrypt.compare(req.body.password, user.password)
    .then(function(response) {

      if (response) {
        req.session.userId = user._id;
        req.session.username = user.username.charAt(0).toUpperCase() + user.username.slice(1);
        req.session.lastname = user.lastName;
        return res.redirect('/');
      }

      let err = new Error('Sorry but the Username and Password combination do not match!');
      err.url = 'login';
      err.status = 400;
      return next(err);

    }).catch(err => console.error(err.message));
  });
});

router.get('/signout', (req, res, next) => {
  req.session.destroy();
  res.redirect('/');
});

router.get('/delete', checkUserAuth, (req, res, next) => {
  User.deleteOne({ _id: req.session.userId })
  .exec(function(error, user) {
    if (error) {
      return next(error);
    } else {
      req.session.destroy();
      res.redirect('/');
    }
  });
});

//Handles search function
router.post('/search', async (req, res, next) => {
  if (req.session.userId) {

    let urls =  await fetchApi(`http://api.giphy.com/v1/gifs/search?q=${req.body.search}&limit=12&api_key=dc6zaTOxFJmzC`)
    .then(data => data.data)

    req.session.search = req.body.search;
    req.session.searchedUrls = urls

    return res.redirect('/results');
  } else {
    res.redirect('/login');
  }


});

router.get('/results', async (req, res, next) => {
  if (!req.session.userId) {
    res.redirect('/');
  }

  let client = await twitter.get('search/tweets', {q: `${req.session.search}`, count: 12}, (error, tweets, response) => {
    if (error) {
      throw error;
    }
    console.log(tweets.statuses[0]);

    return res.render('results', {
      user: req.session.userId,
      name: req.session.username,
      urls: req.session.searchedUrls,
      tweets: tweets.statuses
    });
  });
});

//Route for authenticating with Twitter API


module.exports = router;
