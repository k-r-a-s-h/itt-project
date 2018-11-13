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
var nodemailer           =require('nodemailer');
//var Campground           =require("./models/campground.js");
//var Comment              =require("./models/comment.js");
//var User                 =require("./models/user");
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'smoked.turing@gmail.com',
        pass: 'Turing@2018'
    }
});
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
//admin access begin================================================================================================================================
app.get("/admin/campgrounds",authenticationMiddleware(),function(req,res){
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
                res.render("admin/index",{campgrounds: result.rows});
            }
            doRelease(connection);
        });
    });
});

app.get("/admin/campgrounds/:id",authenticationMiddleware(),function(req, res) {
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
                //console.log(result.rows);
            }
            query="SELECT content, name ,user_id,comment_id FROM comments natural join users where camp_id=:id";
            connection.execute(query, [req.params.id], {outFormat: oracledb.OBJECT}, function(err, result) {
                if (err) {
                    console.log(err);
                    throw err;
                } else {
                    //console.log(result.rows);
                }
                if(req.isAuthenticated()){
                    console.log(req.user.user_id);
                }
                //console.log({campground: camp, comments: result.rows});
                res.render("admin/show", {message: req.flash('error'),message1:req.flash('done'),campground: camp, comments: result.rows, auth_id:(req.user ? req.user.user_id : 0 )});
            });
        });


    });
});

app.post("/admin/campgrounds/:id/delete",authenticationMiddleware(),function(req,res){
    handleDatabaseOperation(req,res,function(request,response,connection){
        const id=req.params.id;
        const query="delete from campgrounds where id=:id";
        connection.execute(query,[id],{autoCommit:true,outFormat:oracledb.OBJECT},function(err,result){
            if(err){
                //throw err;
                req.flash('error', 'Bookings found to this campgrounds');
                res.redirect("/admin/campgrounds/"+id);
            }
            else{

                res.redirect("/admin/campgrounds");
            }
        })
    })
});

app.post("/admin/campgrounds/:id/comments/:comment_id/delete",authenticationMiddleware(),function(req,res){
    const user_id=req.body.userid;
    // console.log(user_id);
    const camp_id=req.params.id;
    const comment_id=req.params.comment_id;
    handleDatabaseOperation(req, res, function(request, response, connection) {
        var query="delete from comments where user_id=:user_id and camp_id=:camp_id and comment_id=:comment_id";
        connection.execute(query, [user_id,camp_id,comment_id], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result){
            if (err) {
                console.log(err);
                throw err;
            } else {
                console.log("done");
                req.flash('done', 'Comment Deleted');
                res.redirect("/admin/campgrounds/"+camp_id);
            }
            doRelease(connection);
        });

    });
});
app.get("/admin/bookings",authenticationMiddleware(),function(req,res) {

    handleDatabaseOperation(req, res, function (request, response, connection) {
        var query = "select * from booking,campgrounds,users where camp_id=id and booking.user_id=users.user_id";
        connection.execute(query, [], {autoCommit: true, outFormat: oracledb.OBJECT}, function (err, result) {
            if (err) {
                console.log(err);
                throw err;
            } else {
                handleDatabaseOperation(req, res, function (request, response, connection) {
                    query = "select * from cancellation natural join tran";
                    connection.execute(query, [], {autoCommit: true, outFormat: oracledb.OBJECT}, function (er, resul) {
                        if (er) {
                            console.log(er);
                            throw er;
                        } else {
                            // console.log("done");
                            res.render("admin/bookingshow", {results: result.rows, cancelled: resul.rows});
                        }
                    });
                });
                // res.send(result.rows);
            }

            doRelease(connection);
        });

    });
});

app.get("/admin/bookings/:booking_id",authenticationMiddleware(),function(req,res){
    handleDatabaseOperation(req,res,function(request,response,connection){
        var bookings=req.params.booking_id;
        var query="SELECT * FROM BOOKING,CAMPGROUNDS WHERE BOOKING_ID=:bookings AND CAMP_ID=ID";
        connection.execute(query,[bookings],{outFormat:oracledb.OBJECT},function (err,result) {
            if(err){
                console.log(err);
            }
            else{
                console.log((result.rows));
                res.render("./admin/adminviewbooking",{booked:result.rows});
                // res.send(result.rows);
            }
            doRelease(connection);

        });
    })
});

app.get("/admin/users",authenticationMiddleware(),function (req,res) {
   handleDatabaseOperation(req,res,function(request,response,connection){
       var query="SELECT * FROM USERS WHERE USER_ID != 121";
       connection.execute(query,[],{autoCommit: true,outFormat:oracledb.OBJECT},function (err,result) {
          if(err){
              console.log(err);
          }
          else{
              console.log(result.rows);
              res.render("./admin/adminviewuser",{user:result.rows, message:req.flash('done')});

          }
       });
   }) ;
});

app.post("/admin/users/ban/:id",authenticationMiddleware(),function(req,res){
   handleDatabaseOperation(req,res,function (request,response,connection) {
       var id=req.params.id;
       var query="UPDATE USERS SET BANNED=1 WHERE USER_ID=:id";
       connection.execute(query,[id],{autoCommit: true,outFormat:oracledb.OBJECT},function(err,result){
          if(err){
              console.log(err);
              res.send("error occured");
          }
          else{
              req.flash('done',"User banned!!");
              res.redirect("/admin/users");
          }
       });
   }) ;
});
app.post("/admin/users/unban/:id",authenticationMiddleware(),function(req,res){
    handleDatabaseOperation(req,res,function (request,response,connection) {
        var id=req.params.id;
        var query="UPDATE USERS SET BANNED=0 WHERE USER_ID=:id";
        connection.execute(query,[id],{autoCommit: true,outFormat:oracledb.OBJECT},function(err,result){
            if(err){
                console.log(err);
                res.send("error occured");
            }
            else{
                req.flash('done',"User unbanned!!");
                res.redirect("/admin/users");
            }
        });
    }) ;
});
//admin access closes here

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
            req.flash('done',"Comment edited!!");

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
            req.flash('done',"Comment deleted!!");

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
            req.flash('done',"New comment added!!");
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
        req.flash('done',"New Campground Added!");
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
        res.render("campgrounds/index",{campgrounds: result.rows,message:req.flash('done')});
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
        res.render("campgrounds/show", {message:req.flash('done'),message1:req.flash('error'), campground: camp, comments: result.rows, auth_id:(req.user ? req.user.user_id : 0 )});
      });
      });

      
  });
});

//admin login scene
app.get("/admin",function(req,res){

        res.render("admin/login");
});
//admin login post route
var code;
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}
app.post("/admin/login",function(req,res){
    var email="krishna05564@gmail.com";
    var password="password";
    var data={email:email,password:password};
    var d_mail=req.body.username;
    var d_password=req.body.password;
    if(req.body.username==email && req.body.password==password){
        code=getRndInteger(100000,999999);
        var mailOptions = {
            from: 'smoked.turing@gmail.com',
            to: email,
            subject: 'Code for mahecamp admin login',
            text: 'Your login code is '+code
        };
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
                console.log(data);
                res.render("admin/code",{data:data});
            }
        });
    }
    else{
        console.log(d_mail +" "+d_password);
        res.send("Wrong credentials");
    }
});
//verify code
function alreadyAuthenticatedMiddleware() {
    return function(req, res, next) {
        if (req.body.code==code) {
            console.log("\nin\n"+req.body.code+req.body.username);
            return next();
        }
        res.redirect('/admin');
    }
}
 app.post("/admin/login/code",alreadyAuthenticatedMiddleware(),
     passport.authenticate('local',
     {
         successRedirect:'/admin/campgrounds',
         failureRedirect:'/admin'

     })
 );
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
  var admits=req.body.number;
  var camp;
  var transaction;
  var booking_id="BOOK000"+camp_id+user_id+to1+from1+Math.floor((Math.random() * 10000) + 1);
  var query="INSERT INTO booking (booking_id,start_f,end_t,amount,camp_id,user_id,total_people,transaction_id) VALUES(:booking_id,TO_DATE(:from1,'yyyy/mm/dd'),TO_DATE(:to1,'yyyy/mm/dd'),:amount,:camp_id,:user_id,:admits,9999)";
  handleDatabaseOperation(req, res, function(request, response, connection) {
    connection.execute(query, [booking_id,from1,to1,amount,camp_id,user_id,admits], {autoCommit:true, outFormat: oracledb.OBJECT }, function(err, result) {
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
                req.flash('done',"Booking confirmed");
              var booked={camp_id:camp_id,from:from1,to:to1,user_id:user_id,amount:amount,booking_id:booking_id,admits:admits};
              res.render("campgrounds/confirm",{booked:booked,campground: result.rows,message1:req.flash('done'),message:req.flash('error')});
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
      // console.log(result.rows);
        //add front end here
      res.render("bookings",{bookings:result.rows,message1:req.flash('done'),message:req.flash('error')});
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
               // console.log((result.rows));
               res.render("./campgrounds/display",{booked:result.rows,message1:req.flash('done'),message:req.flash('error')});
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
        var query="DELETE from booking where booking_id=:booking_id and user_id=:user_id";
        connection.execute(query,[booking_id,user_id],{autoCommit:true,outFormat:oracledb.OBJECT},function (err,result) {
            if(err){
                console.log(err);
                res.send("some error occurred");
            }
            else{
                req.flash('done','Booking Cancelled!')
                res.redirect("/bookings");
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
            req.flash('done',"Campground Edited Successfully");
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
        // throw err;
          req.flash('error',"Booking found for this campgrounds");
          res.redirect("/campgrounds/"+id);
      }
      else{
            req.flash('done',"Campground deleted!!");
          res.redirect("/campgrounds");
      }
    })
  })
});
//get register page
app.get("/register",function(req, res) {
   res.render("register",{message1:req.flash('done'),message:req.flash('error')});
});
//handle post route register here 
app.post("/register",function(req,res){
  const email=req.body.email;
  const password=req.body.password;
  const name =req.body.name;
  const city =req.body.city;
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
            req.flash('error',"Email-id already used");
            res.redirect("/register");
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
            req.flash('done',"Registration Done. Please Login");
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
    // console.log(req.flash('error'));
   res.render("login",{message: req.flash('error'),message1:req.flash('done')});
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
      var query="SELECT user_id,password FROM users where email=:username and banned=0";
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