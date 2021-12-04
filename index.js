var express = require("express");
var app = express();
var server = require("http").Server(app);
const fs = require('fs')
var io = require("socket.io")(server);
var conn = require('./ConnectMySql');
var dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const bodyParser = require('body-parser');
dotenv.config();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: 'clouduet',
  api_key: '573147231385865',
  api_secret: 'a6XHlMNsiDYiBJaeoY8bWcUW350'
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'upload',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => 'computed-filename-using-request',
  },
});
const parser = multer({ storage: storage });
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

app.post("/upload", parser.single('photo'), async (req, res) => {
  try {
    const sql = `update user_game set url = '${req.file.path}', user_name = '${req.body.userName}' where id_user = '${req.body.idUser}'`
    console.log(sql)
    conn.query(sql, (err, data) => {
      if (err) throw err
      res.send({ path: req.file.path })
    })
  } catch (error) {
    res.status(500).send("Error");
  }
});
let ListRoom = []
var users = [];
app.post('/getRanking', (req, res) => {
  var sql = `select user_name, url, coin from user_game ORDER by coin DESC limit 5;`
  conn.query(sql, (err, data) => {
    if (err) throw err
    res.send(data)
  })
})
app.post('/getFriend', (req, res) => {
  var sql = `select user_name, coin, url, id_user from user_game where id_user in (select if(id_user2 = '${req.body.idUser}',id_user1, id_user2) as id_user from friend where id_user1 = '${req.body.idUser}' || id_user2 = '${req.body.idUser}');`
  conn.query(sql, (err, data) => {
    if (err) throw err
    res.send(data)
  })
})
app.post('/acceptFriend', (req, res) => {
  var sql1 = `insert into friend (id_user1, id_user2) values ('${req.body.id_user_send}', '${req.body.id_user_receive}')`
  var sql2 = `delete from invite where id_user_send = '${req.body.id_user_send}' and id_user_receive = '${req.body.id_user_receive}'`
  conn.query(sql1, (err, data1) => {
    if (err) throw err
    conn.query(sql2, (err, data2) => {
      if (err) throw err
      res.sendStatus(200)
    })
  })
})
app.post('/deleteInvite', (req, res) => {
  var sql = `delete from invite where id_user_send = '${req.body.id_user_send}' and id_user_receive = '${req.body.id_user_receive}'`
  conn.query(sql, (err, data) => {
    if (err) throw err
    res.sendStatus(200)
  })
})
app.post('/addRemoveUser', (req, res) => {
  var sql;
  if (req.body.add)
    sql = `insert into invite (id_user_send, id_user_receive) values ('${req.body.id_user1}', '${req.body.id_user2}')`;
  else
    sql = `delete from friend where (id_user1 = '${req.body.id_user1}' and id_user2 =  '${req.body.id_user2}') or (id_user1 = '${req.body.id_user2}' and id_user2 = '${req.body.id_user1}')`
  conn.query(sql, (err, data) => {
    res.sendStatus(200)
  })
})
app.post('/getSend', (req, res) => {
  var sql = `select user_name, coin, url, id_user from user_game where id_user in (select id_user_send from invite where id_user_receive = '${req.body.idUser}')`
  conn.query(sql, (err, data) => {
    if (err) throw err
    res.send(data)
  })
})
app.post('/getProfile', (req, res) => {
  var sql = `select count(*) as soluong from friend where (id_user1 = '${req.body.id_user1}' and id_user2 = '${req.body.id_user2}') or (id_user1 = '${req.body.id_user2}' and id_user2  = '${req.body.id_user1}')`
  conn.query(sql, (err, data) => {
    if (data[0].soluong === 0) res.send(true)
    else res.send(false)
  })
})
app.post('/getReceive', (req, res) => {
  var sql = `select user_name, coin, url, id_user from user_game where id_user in (select id_user_receive from invite where id_user_send = '${req.body.idUser}')`
  conn.query(sql, (err, data) => {
    if (err) throw err
    res.send(data)
  })
})
io.on("connection", function (socket) {
  console.log('Kết nối thành công vs ' + socket.id)
  socket.on('addUserId', data => {
    socket.idUser = data
  })
  socket.on('sendChat', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        element.Players.forEach(item => {
          io.to(item.socketId).emit('sendChat', data)
        })
      }
    })
  })
  socket.on('joinRoom', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        if (element.Players.length === element.amount)
          socket.emit('joinError')
        else {
          let joinViewer = false;
          if (element.playing) joinViewer = true;
          const user = { socketId: socket.id, userName: data.userName, coin: data.coin, url: data.url, idUser: data.idUser, ready: false, Viewer: joinViewer, skip: false, cards: null, totalCards: null, dangdanh: null }
          element.Players.push(user)
          socket.local.emit('joinSuccess', { idRoom: element.idRoom, coin: element.coin })
          element.Players.forEach(item => {
            if (item.socketId !== socket.id)
              io.to(item.socketId).emit('updateRoomWhenJoin', user)
          })
          //thiếu return
        }
      }
    })
  })
  socket.on('createRoom', (data) => {
    const room = { nameRoom: data.nameroom, idRoom: getId(6), coin: data.coin, Players: [], playing: false, amount: data.amount, isTurn: 0, password: data.password }
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
          element.Players.forEach((item) => {
            conn.query(`update user_game set coin = coin - ${element.coin} where id_user = '${item.idUser}'`, (err, data) => {
              if (err) throw err
            })
            item.coin -= element.coin
          })
          element.tongtiencuoc = element.coin * element.Players.length;
          element.playing = true;
          io.sockets.emit('updateRoom', getRoom(ListRoom)) // update room
          element.Players.forEach((item, index) => {
            item.ready = false;
            item.cards = list.slice(index * 13, (index + 1) * 13);
            item.totalCards = 13;
            io.to(item.socketId).emit('test', { listCards: list.slice(index * 13, (index + 1) * 13), isTurn: element.isTurn })
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
        value.Players.forEach(element => {
          io.to(element.socketId).emit('updateIsTurn', i)
          if (element.idUser === data.idUser) element.totalCards -= data.listCard.length;
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
          if (element.idUser === data.idUser)
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
          if (length === 1) break;
        }
        value.isTurn = i;
        value.Players.forEach(element => {
          io.to(element.socketId).emit('updateIsTurn', i)
        })
        let count = 0;
        array.forEach(element => {
          if (element.skip)
            count++;
        })
        value.Players.forEach(element => {
          io.to(element.socketId).emit('skip', data.idUser)
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
      if (element.idRoom === data.idRoom) {
        element.playing = false;
        io.sockets.emit('updateRoom', getRoom(ListRoom))
        // conn.query(`update user_game set coin = coin + ${element.tongtiencuoc} where id_user = '${data.idUser}'`, (err, data) => {
        //   if(err) throw err
        // })
        element.Players.forEach(value => {
          io.to(value.socketId).emit('gameOver', { idUser: data.idUser, tongtiencuoc: element.tongtiencuoc })
        })
      }
    })
  })
  socket.on('logoutRoom', (data) => {
    ListRoom.forEach(element => {
      if (element.idRoom === data.idRoom) {
        element.Players = element.Players.filter(item => {
          return item.idUser !== data.idUser
        })
        element.Players.forEach(item => {
          io.to(item.socketId).emit('removeUser', data.idUser)
        })
        if (element.playing) {
          let x = 0;
          var idUser = ''
          element.Players.forEach(item => {
            if (!item.Viewer) {
              x++;
              idUser = item.idUser;
            }
          })
          if (x <= 1) {
            element.Players.forEach(item => {
              io.to(item.socketId).emit('gameOver', { idUser: idUser, tongtiencuoc: element.tongtiencuoc })
              conn.query(`update user_game set coin = coin + ${element.tongtiencuoc} where id_user = '${idUser}'`, (err, data) => {
                if (err) throw err
              })
              item.coin += element.tongtiencuoc
            })
            element.playing = false;
          }
        }
        if (element.Players.length === 0) element.playing = false;
        io.sockets.emit('updateRoom', getRoom(ListRoom))
      }
    })
  })
  socket.on('sendInvite', (data) => {
    for (key in io.sockets.sockets) {
      if (io.sockets.sockets[key].idUser === data.idUser) {
        io.to(key).emit('sendInvite', data)
      }
    }
  })
  socket.on("disconnect", function () {
    ListRoom.forEach((element, i) => {
      let user;
      element.Players.forEach(item => {
        if (item.socketId === socket.id) {
          user = item;
        }
      })
      if (user) {
        element.Players = element.Players.filter(item => {
          return item.socketId !== socket.id;
        })
        element.Players.forEach(item => {
          console.log(item.socketId)
          io.to(item.socketId).emit('removeUser', user.idUser)
        })
        if (element.playing) {
          let x = 0;
          var idUser = ''
          element.Players.forEach(item => {
            if (!item.Viewer) {
              x++;
              idUser = item.idUser;
            }
          })
          if (x <= 1) {
            element.Players.forEach(item => {
              io.to(item.socketId).emit('gameOver', { idUser: idUser, tongtiencuoc: element.tongtiencuoc })
              conn.query(`update user_game set coin = coin + ${element.tongtiencuoc} where id_user = '${idUser}'`, (err, data) => {
                if (err) throw err
              })
              item.coin += element.tongtiencuoc
            })
            element.playing = false;
          }
        }
        if (element.Players.length === 0) element.playing = false;
        io.sockets.emit('updateRoom', getRoom(ListRoom))
      }
    })
    console.log('Ngắt kết nối vs ' + socket.id)
  })
});
function getRoom(ListRoom) {
  const array = []
  ListRoom.forEach(element => {
    const password = element.password === '' ? false : true
    array.push({ nameRoom: element.nameRoom, idRoom: element.idRoom, coin: element.coin, songuoi: element.Players.length, maxnguoi: element.amount, password: password, playing: element.playing })
  })
  return array;
}
function getId(length) {
  var _sym = 'ZXCVBNMLKJHGFDSAQWERTYUIOP1234567890';
  var id = '';
  for (let i = 0; i < length; i++) {
    id += _sym[parseInt(Math.random() * (_sym.length))];
  }
  return id;
}

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
app.post('/sendPassword', (req, res) => {
  ListRoom.forEach(element => {
    if (element.idRoom === req.body.idRoom) {
      if (element.password === req.body.password)
        res.send(true)
      else
        res.send(false)
      return;
    }
  })
})

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  var sql = `select id_user, user_name, email, coin, url from user_game where email = '${email}' and password = '${password}'`
  conn.query(sql, (err, data) => {
    if (data.length > 0) {
      res.send({ login: true, ...data[0] })
    }
    else res.send({ login: false })

  })
})
app.post('/sendEdit', (req, res) => {
  const { idUser, url, userName } = req.body;
  console.log(req.body)
  var sql = `update user_game set url = ${url}, user_name = '${userName}' where id_user = '${idUser}'`
  console.log(sql)
  conn.query(sql, (err, data) => {
    res.send(true)
  })
})
app.post('/signup', (req, res) => {

  const { email, password } = req.body;
  const idUser = getId(10)
  const userName = getId(8)
  const sql2 = `insert into user_game (id_user, email, password, user_name) values ('${idUser}', '${email}', '${password}', '${userName}  ')`
  const sql1 = `select * from user_game where email = '${email}'`
  conn.query(sql1, (err, data1) => {
    if (err) throw err
    if (data1.length > 0) res.send({ signup: false })
    else {
      conn.query(sql2, (err, data2) => {
        if (err) throw err
        res.send({ signup: true, idUser: idUser, userName: userName })
      })
    }
  })
})
server.listen(process.env.PORT || 3000);