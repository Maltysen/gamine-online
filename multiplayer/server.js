const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use('/sounds', express.static('sounds'));
app.use('/gamine.png', express.static('gamine.png'));
app.use('/dice.png', express.static('dice.png'));
app.use('/copy.png', express.static('copy.png'));
app.use('/pencil.png', express.static('pencil.png'));
app.use('/VeraBd.ttf', express.static('VeraBd.ttf'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const ROOM_NOPLAYER_LIFETIME = 10 * 60 * 1000;

class Room {
    event_list = [];
    players = new Set();
    id;
    player_cnt = 0;
    timeout_obj = null;

    constructor(room_id) {
        this.id = room_id;
    }
}

let room = {};
let room_id = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('join_room', (des_room_id) => {
        console.log("joining "+socket.id + " | "+des_room_id);

        if (!(/^[0-9a-zA-Z_\-]{4,15}$/.test(des_room_id))) return;
        if (socket.rooms.length>1) return;

        room_id[socket.id] = des_room_id;

        if (!(room_id[socket.id] in room)) {
            room[room_id[socket.id]] = new Room(des_room_id);
        }
        room[des_room_id].players.add(socket.id);
        let client_side_id = room[des_room_id].player_cnt;
        room[des_room_id].player_cnt++;

        if (room[des_room_id].timeout_obj !== null) {
            clearTimeout(room[des_room_id].timeout_obj);
            room[des_room_id].timeout_obj = null;
        }

        socket.join(des_room_id);

        socket.emit("joined_room", client_side_id, room[des_room_id].event_list);
    });

    socket.on("draw_event", (e) => {
        if (!(socket.id in room_id)) return;

        if (JSON.parse(e).ev_type === "reset") room[room_id[socket.id]].event_list = [];
        room[room_id[socket.id]].event_list.push(e);

        io.to(room_id[socket.id]).emit("draw_event", e);
    });

    socket.on("sound_event", (num) => {
        if (!(socket.id in room_id)) return;

        socket.to(room_id[socket.id]).emit("sound_event", num);
    });

    function leave_room() {
        if (!(socket.id in room_id)) return;

        let rid = room_id[socket.id];
        delete room_id[socket.id];
        socket.leave(rid);
        room[rid].players.delete(socket.id);

        if (room[rid].players.size === 0) {
            room[rid].timeout_obj = setTimeout(((x)=> ()=>{
                delete room[x];
            })(rid), ROOM_NOPLAYER_LIFETIME);
        }

    }

    socket.on('disconnect', leave_room);
    socket.on('leave_room', leave_room);
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
