const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config({path: "./config.env"})

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
});



const http = require("http");

//Create Server
const server = http.createServer(app);

const DB = process.env.DB_URI

const port = process.env.PORT || 8000;

mongoose.connect(DB, {
    //useNewUrlParser: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
    // useUnifiedToplogy: true,
}).then((conn) => {
    console.log("DB connection is successful");
}).catch((err) => {
    console.log(err);
});


//Start Server
server.listen(port, () => {
    console.log(`App is running on ${port}`)
  
});

process.on("unhandledRejection", (err) => {
    console.log(err)
    server.close(() => {
        process.exit(1);
    })
})