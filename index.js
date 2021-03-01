const express = require("express");
const server = express();
const http = require("http").Server(server);
const io = require("socket.io")(http);
var socketList = [];

server.use(express.static("public"));

http.listen(3000, () => {
  console.log("Server started at: 3000");
});

server.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function (socket) {
  //소켓 연결 성공하면 보냄.
  //main.js에서 받음.
  io.sockets.emit("user-joined", {
    //소켓의 room을 따로 지정해주 않았기 때문에  clients()로 사용
    //모든 클라이언트들을 넘겨줌.
    clients: Object.keys(io.sockets.clients()),
    count: io.engine.clientsCount,
    joinedUserId: socket.id, //본인의 socket id
  });

  socketList.push(socket);

  socket.on("signaling", function (data) {
    io.to(data.toId).emit("signaling", { fromId: socket.id, ...data });
  });

  socket.on("disconnect", function () {
    io.sockets.emit("user-left", socket.id);
    socketList.splice(socketList.indexOf(socket), 1);
  });

  //메시지를 보낸 경우.
  socket.on("SEND", function (msg) {
    console.log(msg);
    //연결된 모든 소켓 확인.
    socketList.forEach(function (item) {
      console.log(item.id);
      //소켓 돌면서 본인 소켓이 아닌 경우만
      if (item != socket) {
        item.emit("SEND", msg);
      }
    });
  });
});
