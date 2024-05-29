const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config({ path: "./config.env" });
const User = require("./models/user");
const { Server } = require("socket.io");
const path = require("path");

process.on("uncaughtException", (err) => {
  console.log(err);
  process.exit(1);
});

const http = require("http");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");

//Create Server
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://192.168.8.63:3000",
    methods: ["GET", "POST"],
  },
});

const DB = process.env.DB_URI;

const port = process.env.PORT || 8000;

mongoose
  .connect(DB, {
    //useNewUrlParser: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
    // useUnifiedToplogy: true,
  })
  .then((conn) => {
    console.log("DB connection is successful");
  })
  .catch((err) => {
    console.log(err);
  });

//Start Server
server.listen(port, () => {
  console.log(`App is running on ${port}`);
});
io.on("connection", async (socket) => {
  //console.log(JSON.stringify(socket.handshake.query))
  const user_id = socket.handshake.query["user_id"];
  const socket_id = socket.id;

  console.log(`user connected ${socket_id}`);

  if (Boolean(user_id)) {
    await User.findByIdAndUpdate(user_id, { socket_id, status: "Online" });
  }

  socket.on("friend_request", async (data) => {
    console.log(data.to);

    // data = To, From

    const to_user = await User.findById(data.to).select("socket_id");
    const from_user = await User.findById(data.from).select("socket_id");

    //Create Friend Request
    await FriendRequest.create({
      sender: data.from,
      recipient: data.to,
    });

    // Emit Event => 'new_friend_request'
    io.to(to_user.socket_id).emit("new_friend_request", {
      message: "New Friend Request Received",
    });
    // emit event => request_sent
    io.to(from_user.socket_id).emit("request_sent", {
      message: "Request Sent Successfully",
    });
  });

  socket.on("accept_request", async (data) => {
    //console.log(data);
    const request_doc = await FriendRequest.findById(data.request_id);

    console.log(request_doc);

    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recipient);

    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);

    await sender.save({ new: true, validateModifiedOnly: true });
    await receiver.save({ new: true, validateModifiedOnly: true });

    await FriendRequest.findByIdAndDelete(data.request_id);

    io.to(sender.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });

    io.to(receiver.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
  });

  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id] },
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversations);

    callback(existing_conversations);
  });

  socket.on("start_conversation", async (data) => {
    //data {to, from}

    const { to, from } = data;
    //check if ther is any existing conversation between these users
    const existing_conversation = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversation[0], "Existing Conversation");

    //if no existing conversation
    if (existing_conversation.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });

      new_chat = await OneToOneMessage.findById(new_chat._id).populate(
        "participants",
        "firstName lastName _id email status"
      );

      console.log(new_chat);
      socket.emit("start_chat", new_chat);

      // If there is existing_conversation
    } else {
      socket.emit("start_chat", existing_conversation[0]);
    }
  });

  socket.on("get_messages", async (data, callback) => {
    const { messages } = await OneToOneMessage.findById(
      data.conversation_id
    ).select("messages");
    callback(messages);
  });

  //To handle text/link messages
  socket.on("text_message", async (data) => {
    console.log("Received message", data);

    //Data: {to, from, message, conversation_id, type}
    const {to, from, message, conversation_id, type} = data;
    const to_user = await User.findById(to);
    const from_user = await User.findById(from);
    const new_message = {
      to,
      from,
      type,
      text: message,
      created_at: Date.now()
    }

    //Create new conversation if its not existing or add new message to the messages list
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages.push(new_message)
    // Save to db
    await chat.save({});

    //emit new_message -> to user
    io.to(to_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    })

    //emit new_message  -> from user
    io.to(from_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    })
  });

  socket.on("file_message", (data) => {
    console.log("Received message", data);

    // data: {to, from, text, file}

    //get the file extension
    const fileExtention = path.extname(data.file.name);

    //generate a unique file name
    const fileName = `${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtention}`;

    //Upload file to aws s3 or multer

    //Create new conversation if its not existing or add new message to the messages list

    // Save to db

    //emit incoming_message -> to user

    //emit outgoing message -> from user
  });

  socket.on("end", async (data) => {
    //Find user by Id and set the status to offline
    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    }

    //Broadcast user disconnected
    console.log("closing connection");
    socket.disconnect(0);
  });
});
process.on("unhandledRejection", (err) => {
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
