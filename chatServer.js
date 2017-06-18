var app=require("express")();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var urlencode = require('urlencode');
var Chat = require('./mongoose.js');
var schedule = require('node-schedule');
var cron = '00 00 01 * * *';
var mysql = require('./dbconnection.js');


http.listen(3000, function(){
	console.log("listening at http://127.0.0.1:3000...");
});

var j = schedule.scheduleJob(cron, function(){
	//mongodb 삭제기능
});


io.on('connection',function(socket){

	var getUsersInRoomNumber = function(roomName) {
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

	var emitmsg = function(data){
			
			var messageCode;
			
			//mongodb
			var chat = new Chat();
			chat.roomCode = socket.room;
			chat.senderCode = scode;
			chat.senderName = socket.nickname;
			chat.receiverCode = rcode;
			chat.content = data.msg;
			chat.sendDate = data.date;
			chat.readFlag = data.readFlag;

			chat.save(function(err){
				if(err)
					console.error(err);
			});

			 io.sockets.in(socket.room).emit('msg', {
		    	messageCode : messageCode,
			    scode : scode,
			    nickname : socket.nickname,
			    msg : data.msg,
			    roomCode : socket.room,
			    date : data.date,
			    readFlag : data.readFlag
	 	  	 });
	};

	var nickname;
	var rcode;
	var scode;
	socket.inChat = false;
	console.log("user 입장");

	//채팅방 들어간 것
	socket.on('chat', function(data){
		
		console.log('chat');

		scode = data.scode;
		rcode = data.rcode;
		socket.nickname = data.nickname;
		socket.room = data.room;
		socket.inChat = true;

		var participate = false;
		//아직 대화를 나누지 않은 채팅방에 들어갔을 경우
		if(socket.room==0)
			socket.join(0);

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
		

			if(socket.room==0){
				//방이 없고 새로운 방을 생성해야 하는 경우라면, 방을 생성하고 유저 등록.
				var sql = "insert into messageRoom(latestdate) values('" + data.date + "')";
				mysql.insertIdReturn(sql, function(result){
			
				socket.room = result;
				sql = "insert into roomUser values";
				sql += "(" + socket.room + "," + scode + "),";
				sql += "(" + socket.room + "," + rcode + ")";
				mysql.insert(sql, function(err,result){});
				socket.leave(0);
				socket.join(socket.room);

					var sockets = io.sockets.adapter.rooms['u'+rcode];
					if(sockets!=undefined){
						var socs = sockets['sockets'];
						for (var socketId in socs) {
						var soc = io.sockets.connected[socketId];
							//해당 소켓의 mCode 가 나의 mCode 와 다를 경우
							soc.join(socket.room)
							io.to(soc.id).emit('newRoom',{
								roomCode : socket.room
							});
						}
					}
					emitmsg(data);
				});

			}else{

				emitmsg(data);

			}
	  });

	  //header 와 chatList 에서 쓰임.
	  //모든 룸의 현재 오고있는 메세지를 알려주기 위한 메소드
	  socket.on('joinAllRooms',function(data){

			console.log("joinAllRooms");
			socket.mCode = data.userCode;
	  		socket.join('u'+data.userCode);
	  		var sql = "select roomCode from roomUser where userCode=" + data.userCode;
	  		
	  		mysql.selectList(sql, function(err,rows){
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
					if(getUsersInRoomNumber('u'+scode)>0){ //근데 나와 같은 아이디로 여러개의 연결이 있는 상태
						//또다른 나의 아이디의 inChat 여부 검사
						var sockets = io.sockets.adapter.rooms['u'+scode]['sockets'];
						//for 문으로 소켓 하나씩 검사
						for (var socketId in sockets) {
							var soc = io.sockets.connected[socketId];
							//해당 소켓의 mCode 가 나의 mCode 와 다를 경우
							if(soc['inChat']){
								//현재 타인이 채팅방에 있는지 여부를 저장
								participate = soc['inChat'];
								break;
							}
						}
					}else if(getUsersInRoomNumber('u'+scode)==0){ //같은 아이디에서 한개의 연결만이 있는 상태이므로 내가 나가면 진짜 나가는 것
						participate = false;
					}
				}	

				socket.broadcast.to(socket.room).emit('left',{
			  		nickname : socket.nickname,
			  		participate : participate
		  		});
			}		  	
	  });
});