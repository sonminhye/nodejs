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


	var rcode;

	//평소에는 inChat변수가 false
	socket.inChat = false;
	console.log("user 입장");

	//채팅방 들어감
	socket.on('chat', function(data){

		console.log('chat');

		rcode = data.rcode; //상대방 코드
		socket.mCode = data.scode; //나의 유저코드
		socket.nickname = data.nickname; //나의 닉네임
		socket.room = data.room; //방 코드가 몇번인지

		//채팅페이지에 들어갔을 경우 inChat 은 true
		socket.inChat = true;

		//상대방의 inChat 여부를 검사하는 변수
		var participate = false;

		//대화를 나누지 않은 채팅방에 들어갔을 경우
		if(socket.room==0){
			//임시 방에 들어감.
			socket.join(0);
		}else{

			var ucnt = userCount('u' + socket.mCode); 
			var rcnt = userCount(socket.room); //룸 안의 모든 소켓 개수

			if(ucnt != rcnt){ //상대방이 존재할 경우에만

				//해당 룸의 모든 socket 정보
				var sockets = io.sockets.adapter.rooms[socket.room]['sockets'];

				for (var socketId in sockets) {
					var soc = io.sockets.connected[socketId];
					//해당 소켓의 mCode 가 나의 mCode 와 다를 경우(내가 아니라는 뜻)
					if(soc['mCode'] != socket.mCode){
						//현재 타인이 채팅방에 있는지 여부를 저장
						if(participate){} //현재 타인에게 여러개의 접속이 있다면, true 로 되어있는 연결이 기준
						else {participate = soc['inChat']}; //그게 아니라면 상관없음
					}
				}
			}
		}

		//방에있는 다른 클라이언트에게 이 유저의 입장소식을 알린다.
		socket.broadcast.to(socket.room).emit('join', {
			nickname : socket.nickname,
			participate : participate
		});

		//나에게 환영인사 보내기
		socket.emit('welcome', {
			nickname : socket.nickname,
			participate : participate
		});

		//닉네임 디코딩
		socket.nickname = urlencode.decode(socket.nickname);
		
	});

	 // 메시지 전달
	  socket.on('msg', function(data){
		console.log(socket.room + "의 " + socket.nickname + '가 보낸 msg: ' + data.msg);

			if(socket.room==0){ //방이 없어 새로운 방을 생성해야 하는 경우

				//룸 테이블에 새로운 룸 생성하는 구문
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
									//임시로 조인해줬던 방을떠나고,
									socket.leave(0);
									//새로 부여받은 방 번호로 입장
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
											soc.join(socket.room);
										}
									}
								emitmsg(data); //메세지를 보낸다.
							}); //commit end

						});//mysql add user end

					}); //mysql add room end

				}); //transaction end

			}else{ //기존에 있던 방에 들어갔을 경우

				emitmsg(data); //메세지를 보낸다
			}
	  });

	  //header 와 chatList 에서 쓰임.
	  //모든 룸의 현재 오고있는 메세지를 알려주기 위함
	  socket.on('joinAllRooms',function(data){

			console.log("joinAllRooms");

			socket.mCode = data.userCode;
	  		socket.join('u'+data.userCode);
	  		var sql = "select roomCode from roomUser where userCode=?";

	  		mysql.query(sql, data.userCode, function(err, rows){
				for(idx in rows){
            		socket.join(rows[idx].roomCode);
            		console.log("roomName: " + rows[idx].roomCode + ' 입장');
            	}
	  		});  	
	  });

	  //접속이 끊어지는 부분
	  socket.on('disconnect',function(){

	  		console.log('disconnect');
			socket.inChat = false;
			if(socket.room!=undefined && socket.mCode!=undefined){

				var participate = false;

				var ucnt = userCount('u' + socket.mCode); 
				var rcnt = userCount(socket.room); //룸 안의 모든 소켓 개수

				/*
				room 1 : 소켓 1(A유저), 소켓2(A유저), 소켓3(B유저)
				ucode 1 : 소켓 1(A유저), 소켓2(A유저)
				*/

				if(rcnt != ucnt){  //현재 상대방도 있는 상태일 때
					if(ucnt>0){ //나와 같은 아이디로 여러개의 연결이 있는 상태
						//또 다른 나의 연결의 inChat 여부 검사
						var sockets = io.sockets.adapter.rooms['u'+socket.mCode]['sockets'];
						
						for (var socketId in sockets) {
							
							var soc = io.sockets.connected[socketId];
							
							if(soc['inChat']){
								if(participate){} //현재 나에게 true 로 되어있는 연결이 기준
								else {participate = soc['inChat']}; //그게 아니라면 상관없음
							}
						}
					}else if(ucnt==0){ //같은 아이디에서 한개의 연결만이 있는 상태이므로 내가 나가면 진짜 나가는 것
						participate = false;
					}
				}	

				socket.broadcast.to(socket.room).emit('left',{
			  		nickname : socket.nickname,
			  		participate : participate
		  		});
			}		  	
	  });

	var userCount = function(roomName) {
	    //해당 룸의 모든 소켓들을 가져옴
	    //Room { sockets : { socket 아이디 : true}, length : 1}
	    var room = io.sockets.adapter.rooms[roomName];
		    if (!room) return null;
		    var num = 0;
		    //그 룸의 소켓 아이디들만 추출
		    var clients = room['sockets'];
		    for (var i in clients) {
		    	console.log(i);
		    	num++;
		    }
	    //소켓의 개수 리턴
	    return num;
	};

	//메세지를 저장 후 룸안의 소켓에 전달
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

});