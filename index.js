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
  { nameRoom: 'Phòng số 1', idRoom: '7fd8hfd', coin: 40000, Players: [], playing: false, isTurn: 0, password: 'chuong03022001' }
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
        if (element.Players.length === element.amount)
          socket.emit('joinError')
        else {
          let joinViewer = false;
          if (element.playing) joinViewer = true;
          const user = { socketId: socket.id, userName: data.userName, ready: false, Viewer: joinViewer, skip: false, cards: null, totalCards: null, dangdanh: null }
          element.Players.push(user)
          socket.local.emit('joinSuccess', ListRoom)
          element.Players.forEach(item => {
            io.to(item.socketId).emit('updateRoomWhenJoin', user)
          })
          //thiếu return
        }
        // if (element.Players.length >= 2 && !element.playing) {
        //   console.log('hello')
        //   element.Players.forEach(item => {
        //     io.to(item.socketId).emit('countdown')
        //   })
        // }
      }
    })
  })
  socket.on('createRoom', (data) => {
    const room = { nameRoom: data.nameroom, idRoom: 'fdfdfd', coin: data.coin, Players: [], playing: false, amount: data.amount, isTurn: 0, password: data.password }
    ListRoom.push(room)
    io.sockets.emit('updateRoom', getRoom(ListRoom))
  })  
  socket.on('startGame', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        element.Players.forEach((element, index) => {
          element.Viewer = false;
        })
        let list = []
        for (let i = 3; i <= 15; i++) {
          list.push({ value: i, type: 'co' }, { value: i, type: 'ro' }, { value: i, type: 'chuon' }, { value: i, type: 'bich' })
        }
        list = list.sort(() => Math.random() - 0.5);
        element.Players.forEach((item, index) => {
          if (item.socketId === socket.id) item.ready = true
        })
        let start = true
        element.Players.forEach((item) => {
          if (!item.ready) start = false;
        })
        if (start) {
          ListRoom[0].playing = true
          element.Players.forEach((item, index) => {
            item.cards = list.slice(index * 13, (index + 1) * 13);
            item.totalCards = 13;
            io.to(item.socketId).emit('test', { listCards: list.slice(index * 13, (index + 1) * 13), isTurn: ListRoom[0].isTurn })
          })
        }
        return;
      }
    })
  })
  socket.on('sendCard', (data) => {
    ListRoom.forEach(value => {
      if (value.idRoom === data.idRoom) {
        let array = [];
        value.Players.forEach(element => {
          if (!element.Viewer)
            array.push(element)
        })
        var i = data.index + 1;
        const length = array.length;
        while (true) {
          if (i === length) i = 0;
          if (!array[i].skip)
            break;
          i++
        }
        value.isTurn = i;
        io.sockets.emit('updateIsTurn', i)
        value.Players.forEach(element => {
          if (element.userName === data.userName) element.totalCards -= data.listCard.length;
        })
        value.Players.forEach(element => {
          io.to(element.socketId).emit('sendCard', data)
        })
      }
    })
  })
  socket.on('skip', data => {
    ListRoom.forEach(value => {
      if (value.idRoom === data.idRoom) {
        let array = []
        value.Players.forEach((element) => {
          if (element.userName === data.userName)
            element.skip = true;
        })
        value.Players.forEach(element => {
          if (!element.Viewer)
            array.push(element)
        })
        var i = data.index + 1;
        const length = array.length;
        while (true) {
          if (i === length) i = 0;
          if (!array[i].skip)
            break;
          i++
        }
        value.isTurn = i;
        io.sockets.emit('updateIsTurn', i);
        let count = 0;
        array.forEach(element => {
          if (element.skip)
            count++;
        })
        value.Players.forEach(element => {
          io.to(element.socketId).emit('skip', data.userName)
        })
        if (count + 1 === array.length) {
          value.Players.forEach(element => {
            io.to(element.socketId).emit('resetSkip')
          })
          value.Players.forEach(element => {
            element.skip = false;
          })
        }
        return;
      }
    })
  })
  socket.on('gameOver', (data) => {
    ListRoom.forEach(element => {
      if(element.idRoom === data.idRoom) {
        element.Players.forEach(value => {
          io.to(value.socketId).emit('gameOver', data.userName)
        })
      }
    })
  })
  socket.on('logoutRoom', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        element.Players = element.Players.filter(item => {
          return item.socketId !== socket.id;
        })
        io.sockets.emit('updateRoom', getRoom(ListRoom))
      }
      io.sockets.emit('updatePlayer', element.Players)
      
    })
  })
  socket.on("disconnect", function () {
    ListRoom.forEach(element => {
      element.Players = element.Players.filter(item => {
        return item.socketId !== socket.id;
      })
    })
    ListRoom = ListRoom.filter(item => {
      return item.Players.length > 0
    })
    io.sockets.emit('updateRoom', getRoom(ListRoom))
    console.log('Ngắt kết nối vs ' + socket.id)
  })
});
function getRoom (ListRoom) {
  const array = []
  ListRoom.forEach(element => {
    const password = element.password === '' ? false : true
    array.push({nameRoom: element.nameRoom, idRoom: element.idRoom, coin: element.coin, songuoi: element.Players.length, maxnguoi: element.amount, password: password})
  })
  return array;
}


app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

app.get('/', (req, res) => {
  res.send('hello app heroku!')
})
app.get('/getRooms', (req, res) => {
  res.send(getRoom(ListRoom))
})

app.post('/getPlayer', (req, res) => {
  ListRoom.forEach((element) => {
    if (element.idRoom === req.body.idRoom) {
      res.send({ Players: element.Players, play: element.playing })
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
server.listen(process.env.PORT);