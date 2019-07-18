const express = require('express');
const router = express.Router();
const session = require('express-session');
const auth = require('basic-auth');
const bcrypt = require("bcrypt");
const fetch = require("node-fetch");
const twit = require('twitter'),
  twitter = new twit({
    consumer_key: 'vNMmavoFN2QxhRatYfS7Yil5Z',
    consumer_secret: 'SDeMcccAjCNSdemBZSz6sCtOzXM0YHbWSmXkjOfszGc3KwWs1H',
    access_token_key: '442187206-7fbPiM40f0W8MZWw0FIfuqubXrTVq7u1cpmtXqsT',
    access_token_secret: 'eTXKHGniqUaPVr03r9V0trObKuB3U7mVEp2hgOyCGcjp3'
  })

//Require models
const User = require('../models/user');

//Uses the session function
router.use(session({
  secret: "mfuen5CLe7nHZsLtATWlCZCSevvKNvGc",
  resave: true,
  saveUninitialized: false
}));

const clientID = `811d914139f477648685`;
const clientSecret = `3c1d2b18c4e5c7c0c2d27aff3d72e216fa59872a`;

function fetchApi(endpoint) {
  return fetch(endpoint).then(response => response.json());
}

//Renders home page
router.get('/', async (req, res, next) => {
  if (!req.session.userId) {
    res.redirect('/login')
  } else {

    let urls = await fetchApi(`http://api.giphy.com/v1/gifs/search?q=funny&limit=12&api_key=dc6zaTOxFJmzC`)
    .then(data => data.data);

    let client = await twitter.get('search/tweets', {q: `funny`, count: 12}, (error, tweets, response) => {
      if (error) {
        throw error;
      }

      return res.render('home', {
        user: req.session.userId,
        name: req.session.username,
        urls: urls,
        tweets: tweets.statuses
      });
    });
    //Creates a for loop to pull 6 different images/gifs and then push each to the array
    //render the home page using the array as a varibale and looping each image/gif
  }
});

//Renders Registration page
router.get('/register', (req, res, next) => {
  res.render('register', {
    user: req.session.userId,
    name: req.session.username
  });
});

//Registers a new user
router.post('/register', (req, res, next) => {
  //Validation for if all fields have been entered that are required
  if (
    //If these fields are filled in
    req.body.firstName &&
    req.body.lastName &&
    req.body.email &&
    req.body.username &&
    req.body.password &&
    req.body.confirmedpassword

  ) {
    //Then check to ensure the passwords match. If not then run an error
    if (req.body.password !== req.body.confirmedpassword) {

      let err = new Error('Password must match!');
      err.url = 'register';
      err.status = 400;
      return next(err);
    }

    let userData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      username: req.body.username,
      password: req.body.password
    }

    User.findOne({ username: req.body.username})
    .exec(function (error, user) {
      if (error) {
        return next(error)
      } else if (user) {
        let err = new Error('Username already exists');
        err.status = 400;
        err.url = 'register';
        return next(err);
      } else {
        User.findOne({ email: req.body.email})
        .exec(function (error, user) {
          if (error) {
            return next(error)
          } else if (user) {
            let err = new Error('Email address already associated with an account');
            err.status = 400;
            err.url = 'register';
            return next(err)
          } else {
            //Inserts the data object into Mongo
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
          }
        });
      }
    });

  } else {
    //If fields weren't filled, then run error
    let err = new Error('All fields are required!');
    err.url = 'register';
    err.status = 400;
    return next(err);

  }
});

//Renders login page
router.get('/login', (req, res, next) => {
  res.render('login', {
    user: req.session.userId,
    name: req.session.username,
    clientID: clientID
  });
});

//Logs in a User
router.post('/login', (req, res, next) => {
  //Validation for if all fields have been entered that are required
  if (
    //If these fields are filled in
    req.body.email &&
    req.body.password
  ) {
    //Validate Username is a username in our system or email in our system
    User.findOne({ email : req.body.email })
    .exec(function (error, user) {
      if (error) {
        return next(error);
      } else if (!user) {
          let err = new Error('No User Found');
          err.url = 'login';
          err.status = 400;
          return next(err);
      } else if (user) {
        bcrypt.compare(req.body.password, user.password)
        .then(function(response) {
          if (response) {
            req.session.userId = user._id;
            req.session.username = user.username.charAt(0).toUpperCase() + user.username.slice(1);
            req.session.lastname = user.lastName;
            return res.redirect('/');
          } else {
            let err = new Error('Sorry but the Username and Password combination do not match!');
            err.url = 'login';
            err.status = 400;
            return next(err);
          }
        })
        .catch(err => console.error(err.message));
      }
    });
  } else {
    //If fields weren't filled, then run error
    let err = new Error('All fields are required!');
    err.url = 'login';
    err.status = 400;
    return next(err);
  }
});

router.get('/signout', (req, res, next) => {
  req.session.destroy();
  res.redirect('/');
});

router.get('/delete', (req, res, next) => {
  if (req.session.userId) {
    User.deleteOne({ _id: req.session.userId })
    .exec(function(error, user) {
      if (error) {
        return next(error);
      } else {
        req.session.destroy();
        res.redirect('/');
      }
    });
  } else {
    res.redirect('/login');
  }
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
