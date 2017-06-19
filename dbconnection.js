var mysql = require('mysql');
var config = require('./db_info').local;
module.exports = function(){
	return {
		init: function(){
			return mysql.createConnection({
				host: config.host,
				port : config.port,
				user : config.user,
				password : config.password,
				database : config.database
			})
		},
		connection_open: function(conn){
			conn.connect(function(err){
				if(err) 
					console.error('mysql connection error' + err);
				else
					console.info('mysql is connected successfully.');
			})
		}
	}
};

// exports.selectList = function(sql, callback){
// 	mysql_con.query(sql, function (err, result)  {
// 		callback(err,result);
// 	});
// };

// exports.insert = function(sql){
// 	mysql_con.query(sql, function (err, result)  {
// 		if(err) throw err;
// 	});
// };

// exports.insertIdReturn = function(sql, callback){
// 	mysql_con.query(sql, function (err, result)  {
// 		return callback(result.insertId);
// 	});
// };

exports.insertbyValue = function(sql, value, callback){
	mysql_con.query(sql, value, function (err, result)  {
		return callback(err, result.insertId);
	});
};