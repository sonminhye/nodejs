var app=require("express")();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var urlencode = require('urlencode');
var _ = require('underscore');

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
		throw err; //에러를 throw 한다는 것이 어떤 의미인지! 잘 알아둘 것
	}
});


http.listen(3000, function(){
	console.log("listening at http://127.0.0.1:3000...");
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


	var nickname;
	var nick_k;
	var room;
	var rcode;
	var scode;

	socket.inChat = false;

	//채팅방 들어간 것
	socket.on('join', function(data){

		socket.nickname = data.nickname;
		socket.room = data.room;
		scode = data.scode;
		rcode = data.rcode;
		socket.mCode = scode;
		socket.inChat = true;
		
		socket.join(socket.room);
		socket.join(scode);
		
		var participate = false;

		if(getUsersInRoomNumber(socket.room) != getUsersInRoomNumber(scode)){ //현재 나 말고 누군가 있다
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
		console.log(socket.room + "번 방에 " + socket.nickname + " 유저 입장");

	});

	 // 메시지 전달
	  socket.on('msg', function(data){

		console.log(socket.room + "의 " + socket.nickname + '가 보낸 msg: ' + data.msg);
		var readFlag = data.readFlag;

		//같은 방에 있는 상대방이 읽고 있다면,
		//readFlag 를 1로 하고, 아니라면 0 으로
		    io.sockets.in(socket.room).emit('msg', {
		      scode : scode,
		      nickname : socket.nickname,
		      msg : data.msg,
		      roomCode : socket.room,
		      date : data.date,
		      readFlag : readFlag
		    });	

			var sql = "insert into message set ?";
		    var value = {roomCode:socket.room, senderCode:scode, receiverCode:rcode,content:data.msg, sendDate:data.date, readFlag:readFlag};
				mysql_con.query(sql, value, function (err, result)  {
				if (err) throw err;
			});

	  });

	  //header 와 chatList 에서 쓰임.
	  //모든 룸의 메세지(안읽은) 개수를 카운트 해주기 위한 메소드
	  socket.on('joinAllRooms',function(data){

	  		socket.join(data.userCode);
			console.log('userCode: ' + data.userCode);

	  		var sql = "select roomCode from messageRoom where senderCode=" + data.userCode + " or receiverCode=" + data.userCode;
	  		mysql_con.query(sql, function(err,rows){
	  			for(idx in rows){
                	socket.join(rows[idx].roomCode);
                	console.log("roomName: " + rows[idx].roomCode + ' 입장');
            	}
	  		});
	  });

	  socket.on('disconnect',function(){

			socket.inChat = false;
			
			if(socket.room!=undefined && scode!=undefined){
				
				var participate = false;
				if(getUsersInRoomNumber(socket.room) != getUsersInRoomNumber(scode)){ //현재 나 말고도 누군가 있는 상태
					if(getUsersInRoomNumber(scode)>0){ //근데 나와 같은 아이디로 여러개의 연결이 있는 상태라면 지금 나가도 나가는게 아님.
						console.log('same user exist');
						participate = true;
					}else if(getUsersInRoomNumber(scode)==0){ //같은 아이디에서 한개의 연결만이 있는 상태이므로 내가 나가면 진짜 나가는 것
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


