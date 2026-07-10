require('dotenv').config();
const express= require('express');
const app= express();
const fs= require('fs');
const fsPromises= require('fs').promises;
const path= require('path');
const cors= require('cors');
const PORT= process.env.PORT || 3500;
const {logger}= require('./middleware/logEvents');
const errorHandler=require('./middleware/errorHandler');
const verifyJWT= require('./middleware/verifyJWT');
const cookieParser= require('cookie-parser');
const corsOptions=require('./config/corsOptions');
const credentials=require('./middleware/credentials');
const mongoose= require('mongoose');
const connectDB= require('./config/dbConn');
connectDB();


app.use(express.static(path.join(__dirname, '/public')));//This hepls us connect images and css files to the pages in views folder like documentation.html

app.use(logger);
app.use(credentials); // credentials must be used before CORS
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use('/subdir', require('./routes/subdir'));
app.use('/', require('./routes/root'));//This run the files in views.
//app.use(express.json());
//app.use(cookieParser());
app.use('/register', require('./routes/register'));
app.use('/verifyEmail', require('./routes/verifyEmail'));
app.use('/forgotPassword', require('./routes/forgotPassword'));
app.use('/resetPassword', require('./routes/resetPassword'));
app.use('/auth', require('./routes/auth'));
app.use('/refresh', require('./routes/refresh'));// and here
app.use('/logout', require('./routes/logout'));// and here
// public user helpers (username availability)
app.use('/users', require('./routes/users'));

// if we say http://localhost:3500/users by a get request, it gives us usernames in the db of all people
// public media route (serve images/videos from DB or disk)
app.use('/media', require('./routes/media'));
app.use(verifyJWT);// whatever is below this will be handled by accessToken
app.use('/employees', require('./routes/api/employees'));
app.use('/uploadintomainpage', require('./routes/api/uploadIntoMainPage'));
app.use('/practiceOne', require('./routes/api/practiceOne'));
app.use('/practice', require('./routes/api/practiceTwo'));
app.use('/practiceThree', require('./routes/api/practiceThreeApi'));
//app.use(logger);

//const allowedOrigns=['https://www.google.com', 'http://127.0.0.1:5500', 'http://localhost:3500'];
/*const corsOptions={
    origin:(origin, callback)=>{
        if (!origin || allowedOrigns.indexOf(origin)!==-1){
            callback(null, true);
        }else{
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus:200
}*/
//app.use(credentials);//credentials must be used above cors
//app.use(cors(corsOptions));
app.use((req, res)=>{
    res.status(404);
    if (req.accepts('html')){
        res.sendFile(path.join(__dirname, 'views', '404.html'));
    }else if (req.accepts('json')){
        res.json({error: '404 Not Found'})
    }else{
        res.type('text').send('404 not found');
    }
})
app.use(errorHandler)
mongoose.connection.once('open', ()=>{
    console.log('Connected to MongoDB');
    app.listen(PORT, ()=>console.log(`Server is running on ${PORT}`));
});

