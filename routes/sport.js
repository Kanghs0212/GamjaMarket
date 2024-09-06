const router = require('express').Router()

function checkLogin(요청, 응답, next){
    if(!요청.user){
        응답.send('로그인하세요');
    }
    next();
}

router.get('/sports', checkLogin, (요청, 응답) => {
    응답.send('스포츠 게시판')
})
router.get('/game', checkLogin, (요청, 응답) => {
    응답.send('게임 게시판')
}) 

module.exports = router