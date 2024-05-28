const express = require("express"); // web framework for node.js
const morgan = require("morgan"); // HTTP request logger middleware for node.js
const rateLimit = require("express-rate-limit"); //anti bot request
const helmet = require("helmet"); // for extra security || for headers
const mongosanitize = require("express-mongo-sanitize"); //for extra security of the data
const bodyParser = require("body-parser");
const xss = require("xss"); // for checking the body if doesnt have a malicious params
const cors = require("cors");
const routes = require("./routes/index");
const app = express();

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(mongosanitize());
//app.use(xss());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000, // 3000 request
  windowMs: 60 * 60 * 1000, //In one hour
  message: "Too many request from this IP, please try again in an hour",
});

app.use("/tawk", limiter);
app.use(routes);

module.exports = app;