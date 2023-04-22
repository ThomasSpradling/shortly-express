const express = require('express');
const path = require('path');
const utils = require('./lib/hashUtils');
const partials = require('express-partials');
const Auth = require('./middleware/auth');
const models = require('./models');
const parseCookies = require('./middleware/cookieParser');
const auth = require('./middleware/auth');


const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(partials());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(parseCookies);
app.use(auth.createSession);

app.get('/',
(req, res) => {
  verifySession.call(this, req, res, () => res.render('index'));
});

app.get('/create',
(req, res) => {
  verifySession.call(this, req, res, () => res.render('index'));
});

app.get('/links',
(req, res, next) => {
  verifySession.call(this, req, res, () => {
    models.Links.getAll()
      .then(links => {
        res.status(200).send(links);
      })
      .error(error => {
        res.status(500).send(error);
      });
  });
});

app.post('/links',
(req, res, next) => {
  var url = req.body.url;
  if (!models.Links.isValidUrl(url)) {
    // send back a 404 if link is not valid
    return res.sendStatus(404);
  }

  return models.Links.get({ url })
    .then(link => {
      if (link) {
        throw link;
      }
      return models.Links.getUrlTitle(url);
    })
    .then(title => {
      return models.Links.create({
        url: url,
        title: title,
        baseUrl: req.headers.origin
      });
    })
    .then(results => {
      return models.Links.get({ id: results.insertId });
    })
    .then(link => {
      throw link;
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(link => {
      res.status(200).send(link);
    });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/logout', (req, res) => {
  models.Sessions.delete({ hash: req.session.hash })
  .then(() => {
      res.cookie('shortlyid', null);
      req.session = {};
      res.redirect('/');
    });
});

app.post('/signup', (req, res) => {
  const username = req.body.username;
  models.Users.getAll({ username })
    .then(user => {
      if (user.length === 0) {
        // console.log('SIGN UP: ', req.body);
        models.Users.create(req.body)
          .then(({ insertId }) => {
            return models.Sessions.update({ hash: req.session.hash }, { userId: insertId });
          })
          .then(({ insertId }) => {
            req.session.userId = insertId;
            req.session.user = { username: req.body.username };
            // console.log('Signed up successfully!');
            res.redirect('/');
          })
      } else {
        // console.log('Failed to signup: User already exists!');
        res.redirect('/signup');
      }
    });
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  models.Users.getAll({
    username: username
  })
    .then(user => {
      if (user.length === 0) {
        // console.log('Failed to sign in: No such user exists!');
        res.redirect('/login');
      } else if (models.Users.compare(req.body.password, user[0].password, user[0].salt)) {
        // console.log('Logged in successfully!');
        res.redirect('/');
      } else {
        // console.log('Failed to sign in: Incorrect password!');
        res.redirect('/login');
      }
    });
});

function verifySession(req, res, cb) {
  if (req.session.userId) {
    cb();
  } else {
    res.redirect('/login');
  }
}


/************************************************************/
// Handle the code parameter route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/:code', (req, res, next) => {

  return models.Links.get({ code: req.params.code })
    .tap(link => {

      if (!link) {
        throw new Error('Link does not exist');
      }
      return models.Clicks.create({ linkId: link.id });
    })
    .tap(link => {
      return models.Links.update(link, { visits: link.visits + 1 });
    })
    .then(({ url }) => {
      res.redirect(url);
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(() => {
      res.redirect('/');
    });
});

module.exports = app;
