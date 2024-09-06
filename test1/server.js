const express = require('express');
const app = express();

app.use(express.static('public'));

app.listen(8000, ()=>{
    console.log('http://localhost:8000 에서 서버 실행중');
})



app.get('/', (요청, 응답)=>{
    응답.sendFile(__dirname + '/index.html');
})