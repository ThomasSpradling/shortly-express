const models = require('../models');
const Promise = require('bluebird');

module.exports.createSession = (req, res, next) => {
  const cookies = req.cookies;
  // By the error handligng of parseCookie, this cookie will be empty if it wasn't valid
  if (cookies.shortlyid) {
    // Grab the current session by hash
    const hash = req.cookies.shortlyid;
    models.Sessions.get({ hash })
      .then(session => {
        // If session exists, then create a cookie storing the hash and add
        // username to session if a userId is given
        if (session) {
          req.session = session;
          res.cookie('shortlyid', req.session.hash);
          const id = session.userId;
          if (!id) {
            next();
          } else {
            req.session.userId = id;
            models.Users.get({ id })
              .then(user => {
                req.session.user = { username: user.username };
                next();
              })
          }
        // if session does not exist, add it with a cookie
        } else {
          models.Sessions.create()
            .then(data => {
              return models.Sessions.get({ id: data.insertId });
            })
            .then(data => {
              req.session = data;
              res.cookie('shortlyid', req.session.hash);
              next();
            })
        }
      });
  } else {
    // if cookie does not exist, create a new session and assign req.session have that session hash and id
    // along with a user id that is determined by the user looged in via POST request
    models.Sessions.create()
      .then(({ insertId: id }) => models.Sessions.get({ id }))
      .then(({ id, hash, userId }) => {
        req.session = { id, hash, userId };
        res.cookie('shortlyid', hash);
        req.session.user = { username: req.body.username };
        return models.Users.get({ username: req.body.username });
      })
      .then(data => {
        if (data && data.id) {
          req.session.userId = data.id;
        }
        next();
      });
  }
};

/************************************************************/
// Add additional authentication middleware functions below
/************************************************************/

