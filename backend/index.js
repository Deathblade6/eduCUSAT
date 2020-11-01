const express = require('express')
const http = require('http')
const app = express()
const server = http.createServer(app)
const socket = require('socket.io')
const io = socket(server)
const bcrypt = require('bcrypt')
const User = require('./models/user')
const bodyParser = require('body-parser')
const cors = require('cors')
const users = {}
var jsonParser = bodyParser.json()
var urlEncodedParser = bodyParser.urlencoded({ extended: false })
const socketToRoom = {}
app.use(cors())
io.on('connection', socket => {
  socket.on('join room', roomID => {
    if (users[roomID]) { const length = users[roomID].length
      if (length === 4) {
        socket.emit('room full')
        return
      }
      users[roomID].push(socket.id)
    } else {
      users[roomID] = [socket.id]
    }
    socketToRoom[socket.id] = roomID
    const usersInThisRoom = users[roomID].filter(id => id !== socket.id)

    socket.emit('all users', usersInThisRoom)
  })

  socket.on('sending signal', payload => {
    io.to(payload.userToSignal).emit('user joined', {
      signal: payload.signal,
      callerID: payload.callerID,
    })
  })

  socket.on('returning signal', payload => {
    io.to(payload.callerID).emit('receiving returned signal', {
      signal: payload.signal,
      id: socket.id,
    })
  })

  socket.on('disconnect', () => {
    const roomID = socketToRoom[socket.id]
    let room = users[roomID]
    if (room) {
      room = room.filter(id => id !== socket.id)
      users[roomID] = room
    }
  })
})

app.get('/', (request, response) => {
  response.send('<h2>p2p</h2>')
})
app.get('/api/users', async (request, response) => {
  const users = await User.find({})
  response.json(users)
})
app.post('/api/users', jsonParser, async (request, response) => {
  const body = request.body
  console.log(body)
  const saltRounds = 10
  const passwordHash = await bcrypt.hash(body.password, saltRounds)
  const user = new User({
    email: body.email,
    username: body.username,
    passwordHash,
    type: 'teacher'
  })
  const savedUser = await user.save()
  response.json(savedUser)
})
app.post('/api/login', jsonParser, async (request, response) => {
  const body = request.body
  const user = await User.findOne({ email: body.email })
  const passowordCorrect = user === null ? false : await bcrypt.compare(body.password, user.passwordHash)
  if (!(user && passowordCorrect)) {
    return response.status(401).json({ error: 'invalid email or password '})
  }
  response.status(200).send({ username: user.username, email: user.email, type: user.type })
})
server.listen(8000, () => console.log('server is running on port 8000'))
