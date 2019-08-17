module.exports = function(){ 
this.listSession=[{userId:"abc",getInfo:false,getIntent:true},{userId:"aloha",getInfo:false,getIntent:true}];

this.searchSession=function (inUserid){
    // console.log(this.listSession)
    for (let i=0;i<this.listSession.length;i++){
        if (inUserid==this.listSession[i].userId){
            return this.listSession[i]
        }
    }
    return null
}

this.insertSession=function (inUserid){
    newSession={userId:inUserid,getInfo:true,getIntent:false};
    this.listSession.push(newSession)
}

this.deleteSession=function (inUserid){
    var lengthBefore=this.listSession.length
    this.listSession=this.listSession.filter(item => item.userId!=inUserid)
    if (lengthBefore==this.listSession.length)
        return false
    return true
}

}