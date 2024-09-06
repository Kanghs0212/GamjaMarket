const router = require('express').Router()
//암호화(해싱)
const bcrypt = require('bcrypt');

const { ObjectId  } = require('mongodb')
let connectDB = require('./../database.js')
let db
connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
 
}).catch((err)=>{
  console.log(err)
})

//multer-s3 와 multer
const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3');
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.S3_KEY,
      secretAccessKey : process.env.S3_SECRET
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'metatoforum1',
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})

function checkLogin(요청, 응답, next){
    if(!요청.user){
        return 응답.send('로그인하세요');
    }
    next();
}

//글작성
router.get('/write' , checkLogin, (요청, 응답)=>{
    try{
        응답.render('write.ejs');
    }catch(e){
        console.log(e);
        응답.status(400).send('에러');
    }
})
router.post('/add',  (요청, 응답)=>{
    
    upload.single('img1')(요청, 응답, async (err)=>{
        if(err) return 응답.send('업로드에러');
        else{
            try{
                if(요청.body.title==''){
                    응답.send('타이틀 빈칸');
                }
        
                else{
                    const count = await db.collection('post').countDocuments();
                    await db.collection('post').insertOne(
                        {
                            title: 요청.body['title'], 
                            content: 요청.body['content'], 
                            img: 요청.file ? 요청.file.location : '',
                            user : 요청.user._id,
                            username : 요청.user.username
                        });
                    응답.redirect('/list/'+(parseInt(count/5)+1));     
                }    
            } catch(e){
                console.log(e);
                응답.status(500).send('서버에러남');
            }      
        }
    })
    
});

//글수정
router.get('/detail/:id/update', async (요청, 응답)=>{
    let result = await db.collection('post').findOne({_id : new ObjectId(요청.params.id)})
    응답.render('update.ejs', {data: result});
})
router.put('/update', async (요청, 응답)=>{

    
    upload.single('img1')(요청, 응답, async (err)=>{
        if(err) return 응답.send('업로드에러');
        else{
            try{

                if(요청.body.title==''){
                    응답.send('타이틀 빈칸');
                }
        
                else{
                    const count = await db.collection('post').countDocuments();
                    console.log(요청.query.imgLocation)
                    let result = await db.collection('post').updateOne(
                        {
                            _id: new ObjectId(요청.body._id),
                            user: 요청.user._id
                        }, 
                        {
                            $set: 
                            { 
                                title: 요청.body['title'], 
                                content:  요청.body['content'], 
                                img: 요청.file ? 요청.file.location : 요청.query.imgLocation,
                                user : 요청.user._id,
                                username : 요청.user.username
                            }
                    });
                    if(result.matchedCount!=0)
                        응답.redirect('/list/'+(parseInt(count/5)+1));
                    else
                        응답.send('유저id가 다릅니다.')
                }    
            } catch(e){
                console.log(e);
                응답.status(500).send('서버에러남');
            }      
        }
    })

    /*
    await db.collection('post').updateMany( {_id: 1},{ $inc: {like: 1 } });
        아이디가 1인 모든 도큐먼트를 수정함.
    */
})

//삭제
router.delete('/delete', async (요청, 응답)=>{
    try{
        let result = await db.collection('post').deleteOne(
        {
            _id : new ObjectId(요청.body.id),
            user : new ObjectId(요청.user._id)
        });
        
        if(result.deletedCount != 0)
            응답.send('done')
        else
            응답.send('fail')
    }catch(e){

        console.log(e);
        응답.status(404).send('에러발생');
        
    }
})

module.exports = router