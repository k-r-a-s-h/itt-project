var express              =require("express");
var app                  =express();
var bodyParser           =require("body-parser");
var oracledb             =require('oracledb');
var LocalStrategy        =require("passport-local").Strategy;
var morgan               =require('morgan');
var cookieParser         =require('cookie-parser');
var session              =require('express-session');
var passport             =require('passport');
var flash                =require('connect-flash');
var bcrypt               =require('bcrypt');
//var Campground           =require("./models/campground.js");
//var Comment              =require("./models/comment.js");
//var User                 =require("./models/user");
var path = require('path');

app.set('view engine', 'ejs'); 

app.use(express.static(path.join(__dirname, 'public')));

app.use(morgan('dev')); // log every request to the console

app.use(cookieParser()); // read cookies (needed for auth)

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

//required for passport
app.use(cookieParser());
app.use(express.static(path.join(__dirname,'public')));
app.use(session({
  secret: 'krashison',
  resave: false,
  saveUninitialized: false
 } ));

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());

passport.serializeUser(function(user_id, done) {
     done(null, user_id);
 });
passport.deserializeUser(function(user_id, done) {
   done(null,user_id);
});
const saltRounds = 10;

app.use(function(req,res,next){
  res.locals.isAuthenticated=req.isAuthenticated();
  next();
});


function handleDatabaseOperation( request, response, callback) {
  oracledb.getConnection(
    {
      user : "yelpcamp",
      password : "password",
      connectString : "localhost/XE"
    },
    function(err, connection)
    {
      if (err) {
        console.log('Error in acquiring connection ...');
        console.log('Error message '+err.message);
        // Error connecting to DB
        response.writeHead(500, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({
        status: 500,
        message: "Error connecting to DB",
        detailed_message: err.message
      }
    ));
    return;
    }

    console.log('Connection acquired ; go execute ');
    callback(request, response, connection);
  });
}

function doRelease(connection) {
	connection.release(function(err) {
		if(err) {
			console.log(err);
		}
	});
}

function authenticationMiddleware () {  
  return (req, res, next) => {
    console.log(`req.session.passport.user: ${JSON.stringify(req.session.passport)}`);

      if (req.isAuthenticated()) return next();
      res.redirect('/login')
  }
}

 


 
app.get("/",function(req,res){
    res.render("landing");
    //res.send("bhak");
});
//about page
app.get("/about",function(req,res){
  handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="select counter_campground from dual";
      connection.execute(query, [], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
          console.log(result.rows);
          var camp=result.rows;
      }
       query="select counter_users from dual";
        connection.execute(query, [], {outFormat: oracledb.OBJECT}, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
        console.log(result.rows);
        var user=result.rows;
      }
       query="select counter_comments from dual";
        connection.execute(query, [], {outFormat: oracledb.OBJECT}, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
          var comment=result.rows;
        console.log(result.rows);
        res.render("about",{lol1:camp,lol2:user,lol3:comment});
      }
      doRelease(connection);
      });
  });
  });
});
});
//edit comment
app.get("/campgrounds/:id/comments/:comment_id/edit",authenticationMiddleware(),function(req,res){
  const id=req.params.id;
  const comment_id=req.params.comment_id;
  const user_id=req.user.user_id;
  handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="select content,camp_id,user_id,comment_id from comments where camp_id=:id and comment_id=:comment_id and user_id=:user_id";
      connection.execute(query, [id,comment_id,user_id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
          console.log(result.rows);

          res.render("comments/edit",{camp:result.rows});
      }
      doRelease(connection);
      });
  
  });
})
app.post("/campgrounds/:id/comments/:comment_id",authenticationMiddleware(),function(req,res){
      const content =req.body.content;
      const user_id=req.user.user_id;
      const id=req.params.id;
      const comment_id=req.params.comment_id;
      handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="update comments set content=:content where camp_id=:id and user_id=:user_id and comment_id=:comment_id";
      connection.execute(query, [content,id,user_id,comment_id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result){
        if (err) {
          console.log(err);
          throw err;
        } else {
          console.log(result.rows);

          res.redirect("/campgrounds/"+id);
      }
      doRelease(connection);
      });
  
  });

});
//delete comment
app.post("/campgrounds/:id/comments/:comment_id/delete",authenticationMiddleware(),function(req,res){
      const user_id=req.user.user_id;
      const camp_id=req.params.id;
      const comment_id=req.params.comment_id;
      handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="delete from comments where user_id=:user_id and camp_id=:camp_id and comment_id=:comment_id";
      connection.execute(query, [user_id,camp_id,comment_id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result){
        if (err) {
          console.log(err);
          throw err;
        } else {
          console.log(result.rows);
          res.redirect("/campgrounds/"+camp_id);
      }
      doRelease(connection);
      });
  
  });
});
//open new comme
app.get("/campgrounds/:id/comments/new",authenticationMiddleware(),function(req,res){

  handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="select id,campname,user_id from campgrounds where id=:id";
      connection.execute(query, [req.params.id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
          console.log(result.rows);

          res.render("comments/new",{camp:result.rows});
      }
      doRelease(connection);
      });
  
  });
});
app.post("/campgrounds/:id/comments",authenticationMiddleware(),function(req,res){
  const user_id=req.user.user_id;
  const comment_desc=req.body.text;
  const comment_id=999;
  const camp_id=req.params.id;
  console.log(user_id);
  handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="insert into comments(comment_id,content,user_id,camp_id) VALUES(:comment_id,:comment_desc,:user_id,:camp_id)";
      connection.execute(query, [comment_id,comment_desc,user_id,camp_id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
        //console.log(result.rows);
        res.redirect("/campgrounds/"+camp_id);
      }
      doRelease(connection);
      });
  });

});
//get the new campground page
app.get("/campgrounds/new",authenticationMiddleware(),function(req, res) {
   res.render("campgrounds/new"); 
 });
//post request new campground
app.post("/campgrounds/new",authenticationMiddleware(),function(req,res){
      const description=req.body.description;
      const campname=req.body.name;
      const imgurl=req.body.image;
      const location=req.body.location;
      const price=req.body.price;
      const user_id=req.user.user_id;
      const id=9999;
      console.log(user_id);
      handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="insert into campgrounds(id,description,campname,imgurl,location,price,user_id) VALUES(:id,:description,:campname,:imgurl,:location,:price,:user_id) ";
      connection.execute(query, [id,description,campname,imgurl,location,price,user_id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
        } else {
        console.log(result.rows);
        res.redirect("/campgrounds");
      }
      doRelease(connection);
      });
  });
});

 //campgrounds index page
app.get("/campgrounds",function(req,res){
  // if(req.user){
  //   console.log(req.user.user_id);
  // console.log(req.isAuthenticated());
  // }
  
	handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="SELECT * FROM campgrounds where id> :id ";
      connection.execute(query, [0], { outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
        } else {
        //console.log(result.rows);
        res.render("campgrounds/index",{campgrounds: result.rows});
      }
      doRelease(connection);
      });
 	});
});
//open campground details page
app.get("/campgrounds/:id", function(req, res) {
    // Find camground with ID
    var camp;
    handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="SELECT id,campname,price,name,imgurl,user_id,description FROM campgrounds natural join users where id=:id";
      connection.execute(query, [req.params.id], {outFormat: oracledb.OBJECT}, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
          camp = result.rows;
        console.log(result.rows);
      }
      query="SELECT content, name ,user_id,comment_id FROM comments natural join users where camp_id=:id";
        connection.execute(query, [req.params.id], {outFormat: oracledb.OBJECT}, function(err, result) {
        if (err) {
          console.log(err);
          throw err;
        } else {
        console.log(result.rows);
      }
      if(req.isAuthenticated()){
        console.log(req.user.user_id);
      }
      console.log({campground: camp, comments: result.rows});
        res.render("campgrounds/show", {campground: camp, comments: result.rows, auth_id:(req.user ? req.user.user_id : 0 )});
      });
      });

      
  });
});
// booking page route
app.get("/campgrounds/:id/book",authenticationMiddleware(),function(req,res){
  var user1=req.user.user_id;
 handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="SELECT * FROM campgrounds where id=:id ";
      connection.execute(query, [req.params.id], { outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
        } else {
        //console.log(result.rows);
        res.render("campgrounds/book",{campground: result.rows,user: user1});
      }
      doRelease(connection);
      });
      
  });
  
});
//book post route...................
app.post("/campgrounds/:id/book",authenticationMiddleware(),function(req,res){
  var camp_id=Number(req.params.id);
  var from1=req.body.from;//check the date 
  var to1=req.body.to;//check the date
  var user_id = Number(req.body.user_id);
  var amount=Number(req.body.bill);
  var cancelled=0;
  var admits=req.body.number;
  var camp;
  var booking_id="BOOK000"+camp_id+user_id+to1+from1+Math.floor((Math.random() * 10000) + 1);
  var query="INSERT INTO booking (booking_id,start_f,end_t,amount,cancelled,camp_id,user_id,total_people) VALUES(:booking_id,TO_DATE(:from1,'yyyy/mm/dd'),TO_DATE(:to1,'yyyy/mm/dd'),:amount,:cancelled,:camp_id,:user_id,:admits)";
  handleDatabaseOperation(req, res, function(request, response, connection) {
    connection.execute(query, [booking_id,from1,to1,amount,cancelled,camp_id,user_id,admits], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
      if (err) {
        console.log(err);
        res.send("error");
      } else {
        console.log("done");
        query="SELECT * FROM campgrounds where id=:id";
        handleDatabaseOperation(req, res, function(request, response, connection) {
        connection.execute(query,[camp_id],{autoCommit:true,outFormat:oracledb.OBJECT},function(err,result){
            if(err){
              console.log(err);
              res.send("error 2");
            }
            else{
              var booked={camp_id:camp_id,from:from1,to:to1,user_id:user_id,amount:amount,booking_id:booking_id,admits:admits};
              res.render("campgrounds/confirm",{booked:booked,campground: result.rows});
            }
          })
        });
        doRelease(connection);

      }
     
    doRelease(connection);
    });    
});


});
//view bookings route.............
app.get("/bookings",authenticationMiddleware(),function(req,res){
  var user1=req.user.user_id;
  handleDatabaseOperation(req, res, function(request, response, connection) {
    var query="SELECT * FROM booking,campgrounds where booking.user_id=:user1 and booking.camp_id=campgrounds.id";
    connection.execute(query, [user1], { outFormat: oracledb.OBJECT }, function(err, result) {
      if (err) {
        console.log(err);
      } else {

      console.log(result.rows);
        //add front end here
      res.render("bookings",{bookings:result.rows});
    }
    doRelease(connection);
    });
 });
});
app.get("/bookings/:booking_id",authenticationMiddleware(),function(req,res){
   handleDatabaseOperation(req,res,function(request,response,connection){
       var bookings=req.params.booking_id;
       var query="SELECT * FROM BOOKING,CAMPGROUNDS WHERE BOOKING_ID=:bookings AND CAMP_ID=ID";
       connection.execute(query,[bookings],{outFormat:oracledb.OBJECT},function (err,result) {
           if(err){
               console.log(err);
           }
           else{
               console.log((result.rows));
               res.render("./campgrounds/display",{booked:result.rows});
           }
           doRelease(connection);

       });
   })
});
//cancel book route
app.get("/bookings/:id/cancel",authenticationMiddleware(),function (req,res) {
    handleDatabaseOperation(req,res,function (request,response,connection) {
        var booking_id=req.params.id.toString();
        var user_id=Number(req.user.user_id);
        var query="UPDATE booking set cancelled=1 where booking_id=:user_id and user_id=:user_id";
        connection.execute(query,[booking_id,user_id],{autoCommit:true,outFormat:oracledb.OBJECT},function (err,result) {
            if(err){
                console.log(err);
                res.send("some error occured");
            }
            else{
                res.redirect("/bookings/"+booking_id);
            }
        })
    })
});
//edit campground age route
app.get("/campgrounds/:id/edit",authenticationMiddleware(),function(req,res){
  handleDatabaseOperation(req, res, function(request, response, connection) {
      var query="SELECT * FROM campgrounds where id=:id ";
      connection.execute(query, [req.params.id], { outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
        } else {
        //console.log(result.rows);
        res.render("campgrounds/edit",{campground: result.rows});
      }
      doRelease(connection);
      });
  });
  
});
// edit post route 
app.post("/campgrounds/:id/edit",authenticationMiddleware(),function(req,res){
  handleDatabaseOperation(req, res, function(request, response, connection) {
      const id=req.params.id;
      const campname=req.body.name;
      const imgurl=req.body.image;
      const description=req.body.description;
      const price =req.body.price;
      const location=req.body.loction;
      const query="update campgrounds set description=:description,campname=:campname,imgurl=:imgurl,location=:location,price=:price where id=:id";
      connection.execute(query, [description,campname,imgurl,location,price,id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          console.log(err);
        } else {
        //console.log(result.rows);
        res.redirect("/campgrounds/"+id);
      }
      doRelease(connection);
      });
  });
});  
// delete campground page
app.post("/campgrounds/:id/delete",authenticationMiddleware(),function(req,res){
  handleDatabaseOperation(req,res,function(request,response,connection){
    const id=req.params.id;
    const query="delete from campgrounds where id=:id";
    connection.execute(query,[id],{autoCommit:true,outFormat:oracledb.OBJECT},function(err,result){
      if(err){
        throw err;
      }
      else{
        res.redirect("/campgrounds");
      }
    })
  })
})
//get register page
app.get("/register",function(req, res) {
   res.render("register"); 
});
//handle post route register here 
app.post("/register",function(req,res){
  const email=req.body.email;
  const password=req.body.password;
  const name =req.body.name;
  const city =req.body.city
  const district=req.body.district;
  const mobile_number=req.body.mobile_number;
   id=99999;

  bcrypt.hash(password, saltRounds, function(err, hash) {
  // Store hash in your password DB.handleDatabaseOperation(req, res, function(request, response, connection) {
     handleDatabaseOperation(req, res, function(request, response, connection) {
      //console.log(email+password+name+city+district+mobile_number+hash);
      var query='insert into users (user_id,name,city,district,phone_no,email,password) VALUES(:id,:name,:city,:district,:mobile_number,:email,:hash)';
      //console.log(query);
      connection.execute(query,[id,name,city,district,mobile_number,email,hash],{autoCommit:true,outFormat: oracledb.OBJECT},function(err, result) {
        if (err) {
          console.log(err);
        } else {
          console.log("registration done please login !!");
          handleDatabaseOperation(req, res, function(request, response, connection) {
          var query2="SELECT user_id FROM users WHERE user_id = ( SELECT MAX(user_id) FROM users )";
          connection.execute(query2,[],{outFormat:oracledb.OBJECT},function(error,results){
            if(error){
              console.log(error);
              throw error;
            }
           //console.log(results.rows[0].USER_ID);
            const user_id=results.rows[0].USER_ID;
            res.redirect("/login");
            doRelease(connection);
          });
          });

         }
      doRelease(connection);
      });
  });
});
  // res.send(email+name+city+district+mobile_number); 

});
//get login page
app.get("/login", function(req, res) {
   res.render("login"); 
});
//handle post login route here
app.post("/login", 
   passport.authenticate('local',
   {
  successRedirect:'/campgrounds',
  failureRedirect:'/login'

})
 );

//logout shit
app.get('/logout',function(req,res){
  req.logout();
  req.session.destroy();
  res.redirect('/');
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    // console.log(username);
    // console.log(password);
    handleDatabaseOperation("", "", function(request, response, connection) {
      var query="SELECT user_id,password FROM users where email=:username";
      connection.execute(query, [username], { outFormat: oracledb.OBJECT }, function(err, result) {
        if (err) {
          done(err);
        }
        if(!result.rows[0]) {
        done(null,false);  
      }
      else {
       const hash = result.rows[0].PASSWORD;
       bcrypt.compare(password,hash,function(err,response){
          if(response===true){
            console.log(result.rows[0].USER_ID);
            return done(null,{user_id: result.rows[0].USER_ID});
          }
          else{
            return done(null,false);
          }
       });
     }
        doRelease(connection);
      });
  })
    }
));
//new campground form

//Server listening

app.listen(3000,process.env.IP,function(){
    console.log(" Yelp Camp server is listening!!");
});