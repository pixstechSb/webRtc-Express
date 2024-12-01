const fs = require('fs');
const https = require('https');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');

const options = {
  key: fs.readFileSync('cert.key'), // Replace with your key path
  cert: fs.readFileSync('cert.crt'), // Replace with your certificate path
};

// Create an Express application
const app = express();
const server = https.createServer(options, app);

// Attach Socket.IO to the server
const io = new Server(server);

// Serve static files (e.g., HTML, JS, CSS)
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle WebRTC signaling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('offer', (data) => {
    console.log('Received offer:', data);
    socket.broadcast.emit('offer', data);
  });

  socket.on('answer', (data) => {
    console.log('Received answer:', data);
    socket.broadcast.emit('answer', data);
  });

  socket.on('candidate', (data) => {
    console.log('Received ICE candidate:', data);
    socket.broadcast.emit('candidate', data);
  });

  socket.on('Test',(message)=>{
    console.log("Test message : ", message)
    socket.emit(message);
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${PORT}`);
});
