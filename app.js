var express = require('express');
var session = require('express-session');
var FileStore = require('session-file-store')(session);
var app = express();
app.listen(3003, function(){
	console.log('Connected 3003 port');
});

//secret 은 우리가 만든 애플리케이션이 세션 아이디를 그냥 평문으로 심지않고ㅗ, 랜덤한 값을 넣어주는 것
//saveUninitialized : 실제로 발급하기 전까지 ... 생성하지 말라는 뜻?
app.use(session({
	secret:'keyboard cat',
	resave: false,
	saveUninitialized:true,
	store:new FileStore()
}));

app.get('/count', function(req,res){
	if(req.session.count){
		req.session.count++;
	}else{
		//count 의 값이 setting 이 되어있지 않을 때
		req.session.count = 1;	
	}
	res.send('count : ' + req.session.count);
});

app.get('/tmp', function(req,res){
	if(req.session.count)
		delete req.session.count;
});