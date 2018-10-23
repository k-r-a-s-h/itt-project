var passport = require('passport');

var session = require('express-session');
  
  app.use(session({
     secret: 'secret',
     resave: true,
     saveUninitialized: false,
     cookie: { maxAge: 60000, secure: false }
  }))

var localStrategy = require('passport-local').Strategy;

 app.use(passport.initialize());
  app.use(passport.session());

    passport.use('local', new localStrategy({ passReqToCallback : true, usernameField: 'username' },
     function(req, username, password, done) {
     
        //We will come back to complete this
     
     }
));

passport.serializeUser(function(user, done) {
     done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
        console.log('called deserializeUser');
        pg.connect(connection, function (err, client) {
        
          var user = {};
          console.log('called deserializeUser - pg');
            var query = client.query("SELECT * FROM users WHERE id = $1", [id]);
        
            query.on('row', function (row) {
              console.log('User row', row);
              user = row;
              done(null, user);
            });
        
            // After all data is returned, close connection and return results
            query.on('end', function () {
                client.end();
            });
        
            // Handle Errors
            if (err) {
                console.log(err);
            }
        });
  
  });