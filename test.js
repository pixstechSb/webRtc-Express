const fs = require('fs');
const https = require('https');
const express = require('express');
const socketio  = require('socket.io');
const path = require('path');

const app = express();

// HTTPS options with mkcert certificates
const options = {
    key: fs.readFileSync('cert.key'),
    cert: fs.readFileSync('cert.crt'),
};

// Serve static files (optional, if you need a frontend)
app.use(express.static('public'));

// Create an HTTPS server
const expressServer = https.createServer(options, app);
const io = socketio(expressServer,{
    cors: {
        origin: [
            "https://localhost:3000",
            "https://localhost:3001",
            // 'https://LOCAL-DEV-IP-HERE' //if using a phone or another computer
        ],
        methods: ["GET", "POST"]
    }
});
//offers will contain {}
const offers = [
    // offererUserName
    // offer
    // offerIceCandidates
    // answererUserName
    // answer
    // answererIceCandidates
];

const connectedSockets = [
    //username, socketId
]
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

console.log("Started")

// Handle Socket.IO connections
try {
    io.on('connection', (socket) => {
        
         // console.log("Someone has connected");
         const userName = socket.handshake.auth.userName;
         const password = socket.handshake.auth.password;
     
         connectedSockets.push({
             socketId: socket.id,
             userName
         })
         // console.log(connectedSockets)
     
         //test connectivity
         socket.on('test',ack=>{
             ack('pong')
         })
    
         socket.on('home',()=>{
            io.emit(path.join(__dirname, 'index.html'));
         })
     
         //a new client has joined. If there are any offers available,
         //emit them out
         if(offers.length){
             socket.emit('availableOffers',offers);
         }
         
         socket.on('newOffer',newOffer=>{
             console.log("newOffer!")
             // console.log(newOffer)
             offers.push({
                 offererUserName: userName,
                 offer: newOffer,
                 offerIceCandidates: [],
                 answererUserName: null,
                 answer: null,
                 answererIceCandidates: []
             })
             // console.log(newOffer.sdp.slice(50))
             //send out to all connected sockets EXCEPT the caller
             console.log("Emmiting newOfferAwaiting")
             socket.broadcast.emit('newOfferAwaiting',offers.slice(-1))
         })
     
         socket.on('newAnswer',(offerObj,ackFunction)=>{
             // console.log(offerObj);
             console.log(connectedSockets)
             console.log("Requested offerer",offerObj.offererUserName)
             //emit this answer (offerObj) back to CLIENT1
             //in order to do that, we need CLIENT1's socketid
             const socketToAnswer = connectedSockets.find(s=>s.userName === offerObj.offererUserName)
             if(!socketToAnswer){
                 console.log("No matching socket")
                 return;
             }
             //we found the matching socket, so we can emit to it!
             const socketIdToAnswer = socketToAnswer.socketId;
             //we find the offer to update so we can emit it
             const offerToUpdate = offers.find(o=>o.offererUserName === offerObj.offererUserName)
             if(!offerToUpdate){
                 console.log("No OfferToUpdate")
                 return;
             }
             //send back to the answerer all the iceCandidates we have already collected
             ackFunction(offerToUpdate.offerIceCandidates);
             offerToUpdate.answer = offerObj.answer
             offerToUpdate.answererUserName = userName
             //socket has a .to() which allows emiting to a "room"
             //every socket has it's own room
             console.log(socketIdToAnswer)
             socket.to(socketIdToAnswer).emit('answerResponse',offerToUpdate)
         })
     
         socket.on('sendIceCandidateToSignalingServer',iceCandidateObj=>{
             const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
             // console.log(iceCandidate);
             if(didIOffer){
                 //this ice is coming from the offerer. Send to the answerer
                 const offerInOffers = offers.find(o=>o.offererUserName === iceUserName);
                 if(offerInOffers){
                     offerInOffers.offerIceCandidates.push(iceCandidate)
                     // 1. When the answerer answers, all existing ice candidates are sent
                     // 2. Any candidates that come in after the offer has been answered, will be passed through
                     if(offerInOffers.answererUserName){
                         //pass it through to the other socket
                         const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.answererUserName);
                         if(socketToSendTo){
                             socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer',iceCandidate)
                         }else{
                             console.log("Ice candidate recieved but could not find answere")
                         }
                     }
                 }
             }else{
                 //this ice is coming from the answerer. Send to the offerer
                 //pass it through to the other socket
                 const offerInOffers = offers.find(o=>o.answererUserName === iceUserName);
                 const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.offererUserName);
                 if(socketToSendTo){
                     socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer',iceCandidate)
                 }else{
                     console.log("Ice candidate recieved but could not find offerer")
                 }
             }
             // console.log(offers)
         })
     
         socket.on('disconnect',()=>{
             const offerToClear = offers.findIndex(o=>o.offererUserName === userName)
             offers.splice(offerToClear,1)
             socket.emit('availableOffers',offers);
         })
    
         socket.on('message',(message)=>{
            console.log('message recieved',message)
            io.emit(message)
         })
    });  

    expressServer.listen(3000, () => {
        console.log('Server is running at https://localhost:3000');
    });
} catch (error) {
    console.log("Socket error: ", error)
}

