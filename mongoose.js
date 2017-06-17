var mongoose = require('mongoose');
var db = mongoose.connection;
db.on('error', console.error);
db.once('open', function(){
	// Connect to mongodb server
	console.log("connected to mongod server");
});

mongoose.connect('mongodb://localhost/minhye');
var Schema = mongoose.Schema;

//스키마 설정
var chatSchema = new Schema({
	roomCode : Number,
	senderCode : Number,
	senderName : String,
	receiverCode : Number,
	content : String,
	sendDate : Date,
	readFlag : Boolean
});	

module.exports = mongoose.model('chats', chatSchema);


