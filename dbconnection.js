var mysql = require('mysql');
var pool = mysql.createPool({
});

var connection = mysql.createConnection({
	host : localhost,
	port : 3306,
	user : 'root',
	password : 8386,
	database : 'travel'
});

connection.connect(function(err){
	if(err){
		console.log("mysql connection error");
		console.err(err);
		throw err; //에러를 throw 한다는 것이 어떤 의미인지! 잘 알아둘 것
	}
});