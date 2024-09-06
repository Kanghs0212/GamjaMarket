//express
const express = require('express');
const app = express();
const path = require('path');
const methodOverride = require('method-override')
//mongdb
const { MongoClient, ObjectId } = require('mongodb')

//socket.io
const { createServer } = require('http')
const { Server } = require('socket.io')
const server = createServer(app)
const io = new Server(server) 

//passport
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

//암호화(해싱)
const bcrypt = require('bcrypt');

//세션을 몽고에 자동 저장
const MongoStore = require('connect-mongo')

//환경변수 저장
require('dotenv').config();

app.use(passport.initialize())
const sessionMiddleware = session({
  secret: process.env.SESSION_PW,
  resave : false,
  saveUninitialized : false,
  cookie : {maxAge : 60 * 60 * 1000},
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : 'forum'
  })
})

app.use(sessionMiddleware);

app.use(passport.session()) 

app.use(methodOverride('_method')) 
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))

const conditionalAuthMiddleware = (req, res, next) => {
    if (req.path === '/') {
        // Skip authentication for the root path
        return next();
    }
    // Apply Passport authentication middleware
    passport.authenticate('session')(req, res, next);
    
};

app.use(conditionalAuthMiddleware);


let connectDB = require('./database.js');
const { time } = require('console');
let db
let changeStream 

connectDB.then((client)=>{
     console.log('DB연결성공')
     db = client.db('forum')
    let 조건 = [
        {
            $match : { operationType : 'insert'}
        }
    ]
    changeStream = db.collection('post').watch(조건)
     // 서버데이터, db가 먼저 연결이 되어야 서버를 실행하도록함
    server.listen(process.env.PORT , ()=>{
        console.log('http://localhost:8080 에서 서버 실행중');
    })
}).catch((err)=>{
  console.log(err)
})

function checkLogin(요청, 응답, next){
    if(!요청.user){
        return 응답.send('로그인하세요');
    }
    next();
}

function isBlank(요청, 응답, next){
    if(요청.body.password=='' || 요청.body.username ==''){
        응답.send('아이디나 비번이 빈칸이오');
    }else{
        next();
    }
}
app.use('/login', isBlank);
app.use('/registry', isBlank);

app.get('/about', (요청, 응답)=>{
    응답.sendFile(__dirname + '/index.html');
})

app.get('/', (요청, 응답)=>{
    응답.render('index.ejs');
})

//db 입력
app.get('/news', (요청, 응답)=>{
    db.collection('post').insertOne({title:'어쩌구'});
    // 응답.send('오늘 비옴');
})

app.get('/list', async (요청, 응답)=>{
    // 첫번째 버전, await을 써야 뒤에 post 코드를 끝낼때까지 js가 기다려줌,
    // 아니면 실행중에 바로 다음 코드를 읽어버림. 요즘 몽고db는 
    // await문법을 강제하는 방향이기에 아래 버전2보단 이걸 외움
    let result = await db.collection('post').find().toArray();

    /*  버전 2
    let result = await db.collection('post').find().toArray().then(()=>{
        console.log(result);
        응답.send('DB에 있던 게시물');
        });
    */
    console.log(요청.user)
    응답.render('list.ejs', {posts: result, number: 요청.params.num, user: 요청.user});
})



app.use('/', require('./routes/post.js'))

app.get('/detail/:id', async (요청, 응답)=>{
    try{
        let result = await db.collection('post').findOne( {_id : new ObjectId(요청.params.id)})
        let comment = await db.collection('comment').find({parent_id :  new ObjectId(요청.params.id)}).toArray();
        if(result==null){
            응답.status(404).send('이상한 url 4rr입력함');
        }
        else
            응답.render('detail.ejs', {data: result, comment: comment});
    } catch(e){
        console.log(e);
        응답.status(404).send('이상한 url 입력함');
    }
    
})


app.get('/search/:num', async (요청, 응답)=>{
    let searchName = 요청.query.val;
    let number = parseInt(요청.params.num)-1;

    if(searchName.length==0){
        let result = await db.collection('post').find().skip(5*number).limit(5).toArray();
        응답.render('search.ejs', {posts: result, number: 요청.params.num, searchName : searchName});
    } else{
        let 검색조건 = [
            {$search : {
              index : 'title_index',
              text : { query : searchName, path : 'title' }
            }},
            {$sort : {_id : 1}}, // 정렬기준, _id순으로 정렬하게됨
            {$limit : 5}, 
            {$skip : 5*number}
            // {$project : {title : 1}} - 데이터가져올때 숨기기기능, 0 = 숨기기, 1 = 보이기 
        ]
    
        // const searchRegex = new RegExp(searchName, 'i');
        let result = await db.collection('post').aggregate(검색조건).toArray();
      
        // 정규식 1번째 방법
        // const searchName = 요청.body.searchName;
        // const searchRegex = new RegExp(searchName, 'i');
        // let result = await db.collection('post').find({title: searchRegex}).toArray();
    
        // 두번째 방법
        // let result = await db.collection('post').find({title: {$regex : 요청.body.searchName}}).toArray();
        응답.render('search.ejs', {posts: result, number: 요청.params.num, searchName : searchName});
    }
})


app.get('/list/:num', async (요청, 응답)=>{
    try{
        var number = parseInt(요청.params.num)-1;
        let result = await db.collection('post').find().skip(5*number).limit(5).toArray();
       
        응답.render('list.ejs', {posts: result, number: 요청.params.num, user: 요청.user});
       
    }catch(e){
        console.log(e);
        응답.status(400).send('에러');
    }
})

// 단 skip()은 숫자가 커질수록 비효율적, 오래걸림

app.get('/list/next/:num', async (요청, 응답)=>{
    try{
        let result = await db.collection('post').find({_id : {$gt : new ObjectId(요청.params.num)}}).limit(5).toArray();
       
        if(result==''){
            console.log('더이상 페이지가 존재하지 않습니다.');
            응답.redirect('/list/1');
        }
        else
            응답.render('list.ejs', {posts: result, number: 요청.params.num});
       
    }catch(e){
        console.log(e);
        응답.status(400).send('에러');
    }
})


//로그인시 인증
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb)=>{
    let result = await db.collection('user').findOne({username: 입력한아이디})
    if(!result){
        return cb(null, false, {message : '아이디 DB에 없음'});
    }

    if(await bcrypt.compare(입력한비번, result.password)){
        return cb(null, result);
    } else{
        return cb(null, false, {message: '비번불일치'});
    }
}))

//세션만들기
passport.serializeUser((user, done)=>{
    
    process.nextTick(()=>{
        done(null, {id : user._id, username : user.username })
    })
})

//유저가 보낸 쿠키분석, 겟요청등에 유저가 전송시 분석후 데이터전송, js 아무대서나 요청.user사용 가능
passport.deserializeUser( async (user, done)=>{
   
    //그냥 user를 done에 넣어도 되지만, user가 예전정보일수 있으므로 새로 db에서 꺼내 넣음
    let result = await db.collection('user').findOne({_id : new ObjectId(user.id)})
    delete result.password; // user 비번은 필요없으니 제거

    process.nextTick(()=>{
        done(null, result)
    })
})

app.get('/login', (요청, 응답)=>{
    console.log(요청.user);
    응답.render('login.ejs')
})

app.post('/login', async (요청, 응답, next)=>{
    passport.authenticate('local', (error, user, info)=>{
        if(error) return 응답.status(500).json(error);
        if(!user) return 응답.status(401).json(info.message);
        요청.logIn(user, (err)=>{
            if(err) return next(err);
            응답.redirect('/');
        })
    })(요청, 응답, next)
})

app.get('/registry', (요청, 응답)=>{
    응답.render('registry.ejs')
})

app.post('/registry', async (요청, 응답)=>{
    try{
        // 여기서도 구현이 가능하지만 자바스크립트로 프론트엔드에서 구현함.
        // else if(요청.body.password != 요청.body.password2){
        //     return 응답.status(400).send('비밀번호 확인이 일치하지 않습니다.');
        // }

        let 해시 = await bcrypt.hash(요청.body.password, 10); // 비번 해싱
        let result = await db.collection('user').findOne({username: 요청.body.username});
        
        if (result) {
            if (result.password === 요청.body.password) {
                // 비밀번호가 이미 존재하는 경우
                return 응답.status(400).send('이미 존재하는 비밀번호입니다.'); // 응답을 보낸 후 함수 종료
            }
            // 아이디가 이미 존재하는 경우
            return 응답.status(400).send('이미 존재하는 아이디입니다.'); // 응답을 보낸 후 함수 종료
        }

        // 아이디와 비밀번호가 모두 문제가 없는 경우
        await db.collection('user').insertOne({ username: 요청.body.username, password: 해시 });
        응답.redirect('/'); // 응답을 보낸 후 함수 종료
        
    }catch(e){
        console.log(e);
        응답.status(500).send('오류발생');
    }
})

// 실행순서 1. 미들웨어(checkLogin), 2.(요청, 응답)=> ...
// 참고로 미들웨어 안에서 응답.send('로그인하세요') 같은 응답을 해버리면 뒤에 코드는 수행안함

app.get('/mypage', checkLogin, async (요청, 응답)=>{
    try{

        응답.render('mypage.ejs', {username: 요청.user.username});
       
    }catch(e){
        console.log(e);
        응답.status(500).send('오류발생');
    }
})

app.use('/board/sub', require('./routes/sport.js'))

app.post('/add/comment', async (요청, 응답)=>{

    await db.collection('comment').insertOne({
        writer_id: new ObjectId(요청.user._id),
        parent_id: new ObjectId(요청.query.id),
        username: 요청.user.username,
        text: 요청.body.comment
    })

    응답.redirect('/detail/'+요청.query.id);
})



app.get('/chat/add', async (요청, 응답)=>{
    try{
        if(요청.user._id.equals(new ObjectId(요청.query.user))){
            return 응답.redirect('/list/1'); 
        }

        let chatRoom = await db.collection('chatroom').findOne( 
            {
                $and: [{member : 요청.user._id}, {member : new ObjectId(요청.query.user)}]
            }
        )

        if(chatRoom==null){
            let result = await db.collection('post').findOne( {_id : new ObjectId(요청.query.id)})
            
            await db.collection('chatroom').insertOne(
                {
                    detail_id : result['_id'],
                    member : [result['user'], 요청.user._id],
                    time : new Date()
                }
            )
         
        }
     
        응답.redirect('/chat/list');
        
    }catch(e){
        console.log(e);
    }
})

app.get('/chat/list', checkLogin, async (요청,응답)=>{
    let result = await db.collection('chatroom').find( { member: new ObjectId(요청.user._id) } ).toArray()
    var post = []

    for(let i = 0; i< result.length; i++){
        let tmp = await db.collection('post').findOne({_id : new ObjectId(result[i]['detail_id'])})

        post.push(tmp['title'])
        post.push(tmp['username'])
    }
    응답.render('chatList.ejs', {chatroom: result, post : post})
})

app.get('/chat/detail/:id', checkLogin, async (요청, 응답)=>{
    let chatRoom = await db.collection('chatroom').findOne({_id : new ObjectId(요청.params.id)})
    let texts =  await db.collection('chattext').find({chatroom_id : new ObjectId(요청.params.id)}).toArray()
    응답.render('chat.ejs', {chatRoom : chatRoom, mine : 요청.user._id, roomNum : 요청.query.number, texts:texts})
})

io.engine.use(sessionMiddleware);

io.on('connection', (socket)=>{
    

    socket.on('ask-join', (data)=>{
        if((socket.request.session.passport.user.id)==data.id)
            socket.join(data.roomNum)
    
    })

    socket.on('message', async (data)=>{
        await db.collection('chattext').insertOne({
            chatroom_id : new ObjectId(data.room),
            text : data.msg,
            writer_id : new ObjectId(socket.request.session.passport.user.id)
        })
        io.to(data.room).emit('broadcast', {msg : data.msg, id : socket.request.session.passport.user.id})
    })
})

app.get('/stream/list', (요청, 응답)=>{
    응답.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
    })

  


   
    changeStream.on('change', (result)=>{
        console.log(result.fullDocument)
        응답.write('event: msg\n')
        응답.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`)

    })
})