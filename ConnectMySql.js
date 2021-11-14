const mysql = require('mysql')
var conn = mysql.createConnection({
    host: "db4free.net",
    user: 'chuong2001',
    password: 'chuong03022001',
    database: 'gametalav1'
})
module.exports = conn;