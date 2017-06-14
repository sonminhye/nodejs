var app=require("express")();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var urlencode = require('urlencode');

var schedule = require('node-schedule');
var cron = '00 00 01 * * *';


var mysql = require('mysql');
var mysql_con = mysql.createConnection({
	host : 'localhost',
	port : 3306,
	user : 'root',
	password : '8386',
	database : 'travel'
});


 //나중에 함수로 다 묶을 것 
mysql_con.connect(function(err){
	if(err){
		console.log("mysql connection error");
		console.err(err);
		throw err;
	}
});

http.listen(3000, function(){
	console.log("listening at http://127.0.0.1:3000...");
});


var j = schedule.scheduleJob(cron, function(){
	var sql = "delete from message where sendDate <= DATE_SUB(NOW(), INTERVAL 30 DAY)"
	mysql_con.query(sql, function(err,rows){
	  	console.log(rows.affectedRows + "건 삭제되었습니다.");
	});
});

io.on('connection',function(socket){

	var getUsersInRoomNumber = function(roomName) {
		console.log('roomName : ' + roomName);
	    var room = io.sockets.adapter.rooms[roomName];
	    if (!room) return null;
	    var num = 0;
	    var clients = room['sockets'];
	    for (var i in clients) {
	    	console.log(i);
	    	num++;
	    }
	    return num;
	};

	var nickname;
	var rcode;
	var scode;
	socket.inChat = false;

	//채팅방 들어간 것
	socket.on('chat', function(data){
		
		scode = data.scode;
		rcode = data.rcode;
		socket.nickname = data.nickname;
		socket.room = data.room;
		socket.mCode = data.scode;
		socket.inChat = true;

		var participate = false;

		if(getUsersInRoomNumber(socket.room) != getUsersInRoomNumber('u'+scode)){ //현재 나 말고 누군가 있다
			
			//해당 룸의 모든 socket 정보들을 가져오고
			var sockets = io.sockets.adapter.rooms[socket.room]['sockets'];
			//for 문으로 소켓 하나씩 검사
			for (var socketId in sockets) {
				var soc = io.sockets.connected[socketId];
				//해당 소켓의 mCode 가 나의 mCode 와 다를 경우
				if(soc['mCode'] != socket.mCode){
					//현재 타인이 채팅방에 있는지 여부를 저장
					participate = soc['inChat'];
					break;
				}
			}
		}

		
		socket.broadcast.to(socket.room).emit('join', {
			nickname : socket.nickname,
			participate : participate
		});

		//들어온 모든 클라이언트에게 알려준다.
		socket.emit('welcome', {
			nickname : socket.nickname,
			participate : participate
		});

		socket.nickname = urlencode.decode(socket.nickname);
		console.log(socket.room + " 룸에 " + socket.nickname + " 유저 입장");
		
	});

	 // 메시지 전달
	  socket.on('msg', function(data){
		console.log(socket.room + "의 " + socket.nickname + '가 보낸 msg: ' + data.msg);
		//같은 방에 있는 상대방이 읽고 있다면,
		//readFlag 를 1로 하고, 아니라면 0 으로
		    io.sockets.in(socket.room).emit('msg', {
		      scode : scode,
		      nickname : socket.nickname,
		      msg : data.msg,
		      roomCode : socket.room,
		      date : data.date,
		      readFlag : data.readFlag
		    });	

			var sql = "insert into message set ?";
		    var value = {roomCode:socket.room, senderCode:scode, receiverCode:rcode,content:data.msg, sendDate:data.date, readFlag:data.readFlag};
				mysql_con.query(sql, value, function (err, result)  {
				if (err) throw err;
			});

	  });

	  //header 와 chatList 에서 쓰임.
	  //모든 룸의 메세지(안읽은) 개수를 카운트 해주기 위한 메소드
	  socket.on('joinAllRooms',function(data){

	  		socket.join('u'+data.userCode);

	  		var sql = "select messageRoom.roomCode from messageRoom join roomUser where roomUser.userCode=" + data.userCode + " group by messageRoom.roomCode";

	  		mysql_con.query(sql, function(err,rows){
	  			for(idx in rows){
                	socket.join(rows[idx].roomCode);
                	console.log("roomName: " + rows[idx].roomCode + ' 입장');
            	}
	  		});
	  });

	  socket.on('disconnect',function(){

	  		console.log('disconnect');
			socket.inChat = false;
			
			if(socket.room!=undefined && scode!=undefined){
				
				var participate = false;
				if(getUsersInRoomNumber(socket.room) != getUsersInRoomNumber('u'+scode)){ //현재 나 말고도 누군가 있는 상태
					if(getUsersInRoomNumber('u'+scode)>0){ //근데 나와 같은 아이디로 여러개의 연결이 있는 상태라면 지금 나가도 나가는게 아님.
						console.log('same user exist');
						//또다른 나의 아이디의 inChat 여부 검사
						var sockets = io.sockets.adapter.rooms['u'+scode]['sockets'];
						//for 문으로 소켓 하나씩 검사
						for (var socketId in sockets) {
							var soc = io.sockets.connected[socketId];
							//해당 소켓의 mCode 가 나의 mCode 와 다를 경우
							if(soc['inChat']){
								//현재 타인이 채팅방에 있는지 여부를 저장
								participate = soc['inChat'];
							}
						}
					}else if(getUsersInRoomNumber('u'+scode)==0){ //같은 아이디에서 한개의 연결만이 있는 상태이므로 내가 나가면 진짜 나가는 것
						console.log('same user not exist');
						participate = false;
					}
				}				
				//나 말고 누가 없으면, participate 는 여전히 false

				socket.broadcast.to(socket.room).emit('left',{
			  		nickname : socket.nickname,
			  		participate : participate
		  		});
			}		  	
	  });
});


