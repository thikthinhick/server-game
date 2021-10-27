var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server);
var conn = require('./ConnectMySql');
var dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const bodyParser = require('body-parser');
dotenv.config();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))


let ListRoom = [
  { nameRoom: 'Phòng số 1', idRoom: '7fd8hfd', coin: 40000, Players: [], playing: false, isTurn: 0 }
]
io.on("connection", function (socket) {
  console.log('Kết nối thành công vs ' + socket.id)
  socket.on('sendChat', (data) => {
    io.emit('sendChat', data)
  })
  // socket.on('Reconnect', (data) => {
  //   ListRoom[0].Players.forEach(value => {
  //   })
  //   socket.join(ListRoom[0].idRoom);
  // })
  socket.on('joinRoom', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        if (element.Players.length === 4)
          socket.emit('joinError')
        else {
          let joinViewer = false;
          if (element.playing) joinViewer = true;
          const user = { socketId: socket.id, userName: data.userName, ready: false, Viewer: joinViewer, skip: false, cards: null, totalCards: null}
          element.Players.push(user)
          socket.local.emit('joinSuccess', ListRoom)
          socket.broadcast.emit('updateRoomWhenJoin', user) // cập nhật bàn khi có người mới vào bàn
          return;
        }
      }
    })  
    if(ListRoom[0].Players.length >= 2 && ListRoom[0].playing === false) {
      io.sockets.emit('countdown');
    }
  })
  socket.on('createRoom', (data) => {
    ListRoom.push({ nameRoom: data.nameRoom, idRoom: 'kfdfdh39', numberOfUsers: 0, coin: 40000, Players: [] })
  })
  socket.on('startGame', (data) => {
    ListRoom[0].Players.forEach(element => {
      element.Viewer = false;
    })
    let list = []
    for (let i = 3; i <= 15 ; i++) {
      list.push({ value: i, type: 'co' }, { value: i, type: 'ro' }, { value: i, type: 'chuon' }, { value: i, type: 'bich' })
    }
    list = list.sort(() => Math.random() - 0.5);
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        element.Players.forEach((item, index) => {
          if (item.socketId === socket.id) item.ready = true
        })
        let start = true
        element.Players.forEach((item, index) => {
          if (!item.ready) start = false;
        })
        if (start) {
          element.playing = true;
          element.Players.forEach((item, index) => {
            item.cards = list.slice(index * 13, (index + 1) * 13);
            item.totalCards = 13;
            io.to(item.socketId).emit('test', { listCards: list.slice(index * 13, (index + 1) * 13), isTurn: ListRoom[0].isTurn})
          })
        }
      }
    })
    if(ListRoom[0].playing)
    io.sockets.emit('updateIsTurn', ListRoom[0].isTurn);
  })
  socket.on('sendCard', (data) => { 
    let array = [];
    ListRoom[0].Players.forEach(element => {
      if(!element.Viewer)
      array.push(element)
    })
    var i = data.index + 1;
    const length = array.length;
    while (true) {
      if (i === length) i = 0;
      if(!array[i].skip) 
        break;
      i++
    }
    ListRoom[0].isTurn = i;
    io.sockets.emit('updateIsTurn', i)
    ListRoom[0].Players.forEach(element => {
      if(element.userName  === data.userName) element.totalCards -= data.listCard.length;
    })
    socket.broadcast.emit('sendCardBroadcast', data);
  })
  socket.on('skip', data => {
    let array = []
    ListRoom[0].Players.forEach((element) => {
      if (element.userName === data.userName)
        element.skip = true;
    })
    ListRoom[0].Players.forEach(element => {
      if(!element.Viewer)
      array.push(element)
    })
    var i = data.index + 1;
    const length = array.length;
    while (true) {
      if (i === length) i = 0;
      if(!array[i].skip) 
        break;
      i++
    }
    ListRoom[0].isTurn = i;
    io.sockets.emit('updateIsTurn', i);
    let count = 0;  
    array.forEach(element => {
      if (element.skip)
        count++;
    })
    io.sockets.emit('skip', data.userName)
    if (count + 1 === array.length) {
      io.sockets.emit('resetSkip')
      ListRoom[0].Players.forEach(element => {
        element.skip = false;
      })
    }
    console.log(ListRoom[0].isTurn)
  })
  
  socket.on('gameOver', (data) => {
    ListRoom[0].Players.forEach(element => {
      if(element.userName === data) console.log(data)
    })
    io.sockets.emit('gameOver', data)
  })

  socket.on('logoutRoom', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        element.Players = element.Players.filter(item => {
          return item.socketId !== socket.id;
        })
      }
      io.sockets.emit('updatePlayer', element.Players)
    })
  })
  socket.on("disconnect", function () {
    ListRoom[0].Players = ListRoom[0].Players.filter(item => {
      return item.socketId !== socket.id;
    })
    ListRoom[0].playing = false;
    console.log('Ngắt kết nối vs ' + socket.id)
    io.sockets.emit('updatePlayer', ListRoom[0].Players)
  })
});



app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});


app.get('/getRooms', (req, res) => {
  res.send(ListRoom)
})

app.post('/getPlayer', (req, res) => {
  ListRoom.forEach((element) => {
    if (element.idRoom === req.body.idRoom) {
      res.send({Players: element.Players, play: element.playing})
    }
  })
})


app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password; 
  const accessToken = jwt.sign(req.body, 'levanchuong', {
    expiresIn: '30m'
  })
  res.json({ accessToken })
})
app.get('/', authenToken, (req, res) => {
  conn.query('select * from user', (err, data) => {
    if (err) throw err
    res.send(data)
  })
})
function authenToken(req, res, next) {
  const authorizationHeader = req.headers['authorization'];
  const token = authorizationHeader.split(' ')[1];
  if (!token) res.sendStatus(401)
  jwt.verify(token, 'levanchuong', (err, data) => {
    console.log(err, data)
    if (err) res.send('error')
    else
      next()
  })
}
server.listen(3000);