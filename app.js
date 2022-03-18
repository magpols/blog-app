// Node modules

require("dotenv").config();
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const LocalStrategy = require('passport-local').Strategy;

const port = process.env.PORT || 3000;

const homeStartingContent = "Welcome to My Journal!";
const aboutContent = "It is All About Me...";
const contactContent = "Find Me Here...";


// Setting up Server
const app = express();


app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));


// Express Session 
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));


// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());


// Connecting Local Database 
mongoose.connect('mongodb://localhost:27017/blogDB', {useNewUrlParser: true});


// Schemas
const postSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true
	},
    date: {
        type: Date,
        default: Date.now
    },
	content: {
		type: String,
		required: true
	}
});
postSchema.index({'**': 'text'});

const userSchema = new mongoose.Schema({
    username: String, 
    password: String
});

userSchema.plugin(passportLocalMongoose);


// Models
const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema);


// Passport Local Authentication
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(new LocalStrategy(User.authenticate()));


// Routes
app.get("/", (req, res) => {
	Post.find((err, posts) => {
		res.render("home", {
			homeStartingContent: homeStartingContent,
			posts: posts
		});
	});
});

app.get("/about", (req, res) => {
	res.render("about", {
		aboutContent: aboutContent,
	});
});

app.get("/contact", (req, res) => {
	res.render("contact", {
		contactContent: contactContent,
	});
});

app.post('/contact', (req, res) => {
    // Instantiate the SMTP server
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        }
    });

    // Specify how email will look like
    const mailOptions = {
        from: 'foo@example.com', 
        to: 'bar@example.com',
        subject: 'New message from contact form at Blog App',
        html: `${req.body.sender_name}<br>(${req.body.sender_email})<br> says: ${req.body.sender_message}`,
    };

    // Attempt to send email
    transporter.sendMail(mailOptions, function (err, response) {
        if (err) {
            console.log(err);
            res.render('contact-failure');
        } else {
            res.render('contact-success');
        }
    });
});


app.get("/compose", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("compose")
    }
});

app.post("/compose", (req, res) => {
    const post = new Post({
        title: req.body.postTitle,
        date: req.body.currentDate,
        content: req.body.postBody,
    });

    post.save((err) => {
        if (!err) {
            res.redirect("/admin");
        } else {
            console.log(err);
        }
    })
});

app.get('/post/:postId', (req, res) => {
    const requestedPost = req.params.postId;
    Post.findById({ _id: requestedPost}, (err, post) => {
        if (err) {
            console.log(err)
        } else {
            res.render('post', {
                title: post.title,
                content: post.content
            })
        }
    });
});

app.post('/search', (req, res) => {
    const keyword = req.body.keyword;

    Post.find({ $text: {$search: keyword}}, (err, result) => {
        if (!result || err) {
            res.render('search', {
                msg: 'No post found!',
                result: null
            });
        } else {
            res.render('search', {
                msg: 'Here is the search result:',
                result: result
            });
        }
    })
})

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/login', (req, res) => {
    res.render('login', { 
        user : req.user
    });
});

app.get('/admin', (req, res) => {
    if (req.isAuthenticated()) {
        Post.find((err, posts) => {
            res.render('admin', {
                posts: posts
            });
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.logout();
    res.render('logout');
})

app.post('/register', (req, res) => {
    User.register({username: req.body.username}, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            res.render('error', {
                msg: err
            });
        } else {
            passport.authenticate('local')(req, res, () => {
                res.redirect('/login')
            });
        }
    }); 
});

app.post('/login', (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if (err) {
            res.render('error', {
                msg: msg
            });
        } else {
            passport.authenticate('local')(req, res, function() {
                res.redirect('/admin');
            })
        }
    })
})

app.post('/delete/:postId', (req, res) => {
    const idToDelete = req.params.postId;

    Post.findByIdAndRemove({_id: idToDelete}, (err, post) => {
        if (!err) {
            console.log("Deleted: " + post);
            res.redirect('/admin')
        } else {
            console.log(err);
        }
    })
});
   
app.get('/edit/:postId', (req, res) => {
    const paramsId = req.params.postId;
    Post.findById({_id: paramsId}, (err, post) => {
        if (!err) {
            res.render('edit', {
                title: post.title,
                date: post.date,
                content: post.content,
                id: post._id
            });
        }
    })
});

app.post('/edit', (req, res) => {
    const postId = req.body.postId;
    const newTitle = req.body.title;
    const newContent = req.body.postBody;

    Post.findByIdAndUpdate({_id: postId}, {
        title: newTitle,
        content: newContent
    }, (err, post) => {
        if (!err) {
            res.redirect('/admin');
        } else {
            res.send(err);
        }
    })
})

app.listen(port, () => console.log(`Server running on Port ${port}`));


