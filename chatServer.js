var app=require("express")();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var urlencode = require('urlencode');
var Chat = require('./mongoose.js');
var mysql_dbc = require('./dbconnection.js')();
var mysql = mysql_dbc.init();
mysql_dbc.connection_open(mysql);


http.listen(3000, function(){
	console.log("listening at http://127.0.0.1:3000...");
});


io.on('connection',function(socket){

	var getUsersInRoomNumber = function(roomName) {
	    //해당 룸의 모든 소켓들을 가져옴
	    //Room { sockets : { socket 아이디 : true}, length : 1}
	    var room = io.sockets.adapter.rooms[roomName];
	    console.log(room);
		    if (!room) return null;
		    var num = 0;
		    //그 룸의 소켓 아이디들만 추출
		    var clients = room['sockets'];
		    for (var i in clients) {
		    	console.log(i);
		    	num++;
		    }
	    //소켓의 개수 리턴해줌
	    return num;
	};

	var emitmsg = function(data){

			var messageCode;	
			//mongodb
			var chat = new Chat();
			chat.roomCode = socket.room;
			chat.senderCode = socket.mCode;
			chat.senderName = socket.nickname;
			chat.receiverCode = rcode;
			chat.content = data.msg;
			chat.sendDate = data.date;
			chat.readFlag = data.readFlag;

			chat.save(function(err, result){

				if(err)
					console.error(err);

				messageCode = result._id;

				io.sockets.in(socket.room).emit('msg', {
			    	messageCode : messageCode,
				    scode : socket.mCode,
				    nickname : socket.nickname,
				    msg : data.msg,
				    roomCode : socket.room,
				    date : data.date,
				    readFlag : data.readFlag
	 	  	 	});

		});
	};

	var nickname;
	var rcode;
	
	//평소에는 inChat변수가 false
	socket.inChat = false;
	console.log("user 입장");

	//채팅방 들어감
	socket.on('chat', function(data){
		console.log('chat');

		rcode = data.rcode;
		socket.mCode = data.scode;
		socket.nickname = data.nickname;
		socket.room = data.room;
		//채팅페이지에 들어갔을 경우 inChat 은 true
		socket.inChat = true;

		var participate = false;
		
		//대화를 나누지 않은 채팅방에 들어갔을 경우
		if(socket.room==0){
			socket.join(0);
		}else{

			if(getUsersInRoomNumber(socket.room) != getUsersInRoomNumber('u'+socket.mCode)){ //현재 나 말고 누군가 있다
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
				//트랜잭션 시작
				mysql.beginTransaction(function(err){
					if(err) {
						throw err;
					}

					//룸 테이블에 삽입
					mysql.query(sql, function(err,result){	
						if(err) {
							mysql.rollback(function(){
								throw err;
							})
						}
						
						//생성된 룸 코드를 socket.room 에 대입
						socket.room = result.insertId;

						//룸 유저를 추가해주기 위한 쿼리
						sql = "insert into roomUser values";
						sql += "(" + socket.room + "," + socket.mCode + "),";
						sql += "(" + socket.room + "," + rcode + ")";

						mysql.query(sql, function(err,result){
							//에러가 있다면 rollback
							if(err) {
								mysql.rollback(function(){
									throw err;
								});
							}

								mysql.commit(function(err){
									if(err) {
										mysql.rollback(function(){
											throw err;
										});
									}
									console.log('success!');
								});
						});
						
						socket.leave(0);
						socket.join(socket.room);

						//현재 해당 유저가 있다면, 새로 만들어진 룸에 조인시키기
						var sockets = io.sockets.adapter.rooms['u'+rcode];
						//해당 유저가 없지 않다면,
						if(sockets!=undefined){
							//소켓 정보들을 가져오고,
							var socs = sockets['sockets'];

							for (var socketId in socs) {
							//해당 소켓아이디에 해당되는 정보를 가져옴
							var soc = io.sockets.connected[socketId];
								//해당 소켓의 mCode 가 나의 mCode 와 다를 경우
								soc.join(socket.room);
							}
						}
						emitmsg(data);
					});

				}); //transaction end
			}else{

				emitmsg(data);

			}
	  });

	  //header 와 chatList 에서 쓰임.
	  //모든 룸의 현재 오고있는 메세지를 알려주기 위함
	  socket.on('joinAllRooms',function(data){

			console.log("joinAllRooms");
			socket.mCode = data.userCode;
	  		socket.join('u'+data.userCode);
	  		var sql = "select roomCode from roomUser where userCode=" + data.userCode;
	  		
	  		mysql.query(sql, function(err, rows){
				for(idx in rows){
            		socket.join(rows[idx].roomCode);
            		console.log("roomName: " + rows[idx].roomCode + ' 입장');
            	}
	  		});  	
	  });

	  socket.on('disconnect',function(){

	  		console.log('disconnect');
			socket.inChat = false;

			if(socket.room!=undefined && socket.mCode!=undefined){
				var participate = false;
				if(getUsersInRoomNumber(socket.room) != getUsersInRoomNumber('u'+socket.mCode)){ //현재 나 말고도 누군가 있는 상태
					if(getUsersInRoomNumber('u'+socket.mCode)>0){ //근데 나와 같은 아이디로 여러개의 연결이 있는 상태
						//또다른 나의 아이디의 inChat 여부 검사
						var sockets = io.sockets.adapter.rooms['u'+socket.mCode]['sockets'];
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
					}else if(getUsersInRoomNumber('u'+socket.mCode)==0){ //같은 아이디에서 한개의 연결만이 있는 상태이므로 내가 나가면 진짜 나가는 것
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