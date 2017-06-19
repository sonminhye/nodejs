var mysql = require('mysql');
var mysql_con = mysql.createConnection({
	host : 'localhost',
	port : 3306,
	user : 'project',
	password : '1234',
	database : 'travel'
});

exports.connect = function(err){
	mysql_con.connect(function(err){
		if(err){
			console.log("mysql connection error");
			console.err(err);
			throw err; //에러를 throw 한다는 것이 어떤 의미인지! 잘 알아둘 것
		}
	});
}

exports.select = function(sql){
		
};

exports.selectList = function(sql, callback){
	mysql_con.query(sql, function (err, result)  {
		callback(err,result);
	});
};

exports.update = function(sql){
	
};

exports.insert = function(sql){
	mysql_con.query(sql, function (err, result)  {
		if(err) throw err;
	});
};

exports.insertIdReturn = function(sql, callback){
	mysql_con.query(sql, function (err, result)  {
		return callback(result.insertId);
	});
};

exports.insertbyValue = function(sql, value, callback){
	mysql_con.query(sql, value, function (err, result)  {
		return callback(err, result.insertId);
	});
};