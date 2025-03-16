const express = require("express");
const app = express();
const fs = require('fs');

let broadcaster;
const port = 9000;
const path = require('path');
var cors = require('cors');

const https = require("https");
const options = {
  key: fs.readFileSync('cert-files/key.pem'),
  cert: fs.readFileSync('cert-files/cert.pem'),
  // ca: fs.readFileSync('C:/Windows/System32/server.csr'),
};
const server = https.createServer(options, app);

const bodyParser = require('body-parser');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const io = require("socket.io")(server);
app.use(cors())
app.use(express.static(__dirname + "/public")); // load files below /public
app.use(express.static(__dirname + '/node_modules'));
app.use(express.json());

app.get('/broadcast', (req, res)=>{
  res.sendFile(path.join(__dirname, 'public/broadcast.html'));
});

app.get('/main', (req, res)=>{
  res.sendFile(path.join(__dirname, 'public/main.html'));
});



io.sockets.on("error", e => console.log(e));
io.sockets.on("connection", socket => {
  console.log("a");
  socket.on("broadcaster", () => {
    broadcaster = socket.id; // set the broadcaster
    socket.broadcast.emit("broadcaster"); // to all id
    console.log("b");
  });
  socket.on("watcher", () => {
    socket.to(broadcaster).emit("watcher", socket.id);
    console.log("c");
  });
  socket.on("disconnect", () => {
    socket.to(broadcaster).emit("disconnectPeer", socket.id);
    console.log("d");
  });


  // initiate webrtc
  socket.on("offer", (id, message) => {
    socket.to(id).emit("offer", socket.id, message);
    console.log("e");
  });
  socket.on("answer", (id, message) => {
    socket.to(id).emit("answer", socket.id, message);
    console.log("f");
  });
  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
    console.log("g");
  });

  // Broadcast.html에서 받은 이미지 저장
  socket.on('videoData', (data) => {
    console.log('Received video data:', data.byteLength); // ArrayBuffer의 byteLength 확인
    
    fs.writeFile('public/images/received_image.jpg', Buffer.from(data), (err) => {
        if (err) throw err;
        console.log('Image saved as received_image.jpg');
    });
  });

});


// 4장의 이미지를 따로따로 저장
let imageUrlList1 = [];
let imageUrlList2 = [];
let imageUrlList3 = [];
let imageUrlList4 = [];
app.get('/ImageUrl1',(req, res)=>{
  console.log('GET /ImageUrl1');
  res.send(imageUrlList1);
});
app.post('/ImageUrl1', (req, res)=>{
  console.log('Saved Image 1');
  imageUrlList1 = req.body.imgUrlList;
  res.send("ok");

  pose1 = req.body.poseData;
  photocount = req.body.photoCount;
  console.log(pose1);
  console.log(`Num of People: ${human_count}`);
  console.log(`Relation: ${selected_photolist}`);
  sendCommand(`calculate_pose_accuracy\n${human_count}\n${selected_photolist}\n${pose1}\n${imageUrlList1}\n${photocount}`);
});

app.get('/ImageUrl2',(req, res)=>{
  console.log('GET /ImageUrl2');
  res.send(imageUrlList2);
});
app.post('/ImageUrl2', (req, res)=>{
  console.log('Saved Image 2');
  imageUrlList2 = req.body.imgUrlList;
  res.send("ok");

  pose2 = req.body.poseData;
  photocount = req.body.photoCount;
  console.log(pose2);
  console.log(`Num of People: ${human_count}`);
  console.log(`Relation: ${selected_photolist}`);
  sendCommand(`calculate_pose_accuracy\n${human_count}\n${selected_photolist}\n${pose2}\n${imageUrlList2}\n${photocount}`);
});

app.get('/ImageUrl3',(req, res)=>{
  console.log('GET /ImageUrl3');
  res.send(imageUrlList3);
});
app.post('/ImageUrl3', (req, res)=>{
  console.log('Saved Image 3');
  imageUrlList3 = req.body.imgUrlList;
  res.send("ok");

  pose3 = req.body.poseData;
  photocount = req.body.photoCount;
  console.log(pose3);
  console.log(`Num of People: ${human_count}`);
  console.log(`Relation: ${selected_photolist}`);
  sendCommand(`calculate_pose_accuracy\n${human_count}\n${selected_photolist}\n${pose3}\n${imageUrlList3}\n${photocount}`);
});

app.get('/ImageUrl4',(req, res)=>{
  console.log('GET /ImageUrl4');
  res.send(imageUrlList4);
});
app.post('/ImageUrl4', (req, res)=>{
  console.log('Saved Image 4');
  imageUrlList4 = req.body.imgUrlList;
  res.send("ok");

  pose4 = req.body.poseData;
  photocount = req.body.photoCount;
  console.log(pose4);
  console.log(`Num of People: ${human_count}`);
  console.log(`Relation: ${selected_photolist}`);
  sendCommand(`calculate_pose_accuracy\n${human_count}\n${selected_photolist}\n${pose4}\n${imageUrlList4}\n${photocount}`);
});


// 와이파이의 ip주소를 찾아서 출력
'use strict';
const {networkInterfaces} = require('os');
const nets = networkInterfaces();
const results = Object.create(null);
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    const familyV4Value = typeof net.family === 'string' ? 'IPv4' :4
    if (net.family === familyV4Value && !net.internal) {
      if (!results[name]) {
        results[name] = [];
      }
      results[name].push(net.address);
    }
  }
}

const ipUrl = results["Wi-Fi"][0]+':9000';
console.log("ip Address");
console.log(ipUrl);
fs.writeFileSync('ip.txt', ipUrl, 'utf8');
server.listen(port, () => console.log(`Server is running on port ${port}\nBroadcasting page -> https://${ipUrl}/broadcast\nUser interface -> https://${ipUrl}/main`));


// 미들웨어 추가
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 데이터 파싱



// 명령을 파일에 기록
const sendCommand = (command) => {
  fs.writeFileSync('public/command/command.txt', command, 'utf8');
  // console.log(`Command "${command}" written to file.`);
};

// /signal로 'Counting' 명령 수신 시 command.txt에 'start_counting' 작성
// 파이썬으로 인원분석 명령 전달
app.post('/signal', (req, res)=>{
  console.log(req.body);
  res.send("ok");
  if(req.body['signal']=='Counting'){
    console.log('COUNTING...')
    sendCommand('start_counting');
  }
});
sendCommand('ready'); // 서버 재 실행시 커멘드 파일 초기화




// 인원과 관계에 따른 포즈 추천하는 함수
let selected_photolist = ""; // 선택된 폴더명을 동적으로 변경하는 변수
let human_count = 0; // 외부 파일에서 현재 인원수 가져오기
let relation = null; // 관계 0 = 혼자 1= 친구 2= 연인 3= 가족 4= 모임/단체
let pose_recommendation_list = []; // 선택된 포즈를 배열의 형태로 보내기 위한 배열

// 이미지 파일 필터링 함수
const isImage = (file) => {
  return ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase());
};

// 포즈를 선택하고 폴더 이름을 설정하는 함수
function selectPose(handle_relation, handle_human_count) {

  if (handle_relation === 0) { // 개인
      selected_photolist = 'solo';

  } else if (handle_relation === 1) { // 친구
      switch (handle_human_count) {
        case 0:
          console.log("No one detected.");
          selected_photolist = '';
          break;
        case 1:
          console.log("Solo person detected.");
          selected_photolist = '';
          break;
        case 2:
          selected_photolist = 'friend2';
          break;
        case 3:
          selected_photolist = 'friend3';
          break;
        default:
          selected_photolist = 'friend4'; // 4명 이상
      }
  } else if (handle_relation === 2) { // 연인
      if (handle_human_count >= 2) {
        selected_photolist = 'lover';

      } else {
        console.log("Not enough people for a couple.");
        selected_photolist = '';
      }
  } else if (handle_relation === 3) { // 가족
      switch (handle_human_count) {
        case 0:
          console.log("No one detected.");
          selected_photolist = '';
          break;
        case 1:
          console.log("Solo person detected.");
          selected_photolist = '';
          break;
        case 2:
          selected_photolist = 'family2';
          break;
        case 3:
          selected_photolist = 'family3';
          break;
        default:
          selected_photolist = 'family4'; // 4명 이상
      }
  } else if (handle_relation === 4) { // 단체
      switch (handle_human_count) {
        case 0:
          console.log("No one detected.");
          selected_photolist = '';
          break;
        case 1:
          console.log("Solo person detected.");
          selected_photolist = '';
          break;
        case 2:
          selected_photolist = 'group2';
          break;
        case 3:
          selected_photolist = 'group3';
          break;
        default:
          selected_photolist = 'group4'; // 4명 이상
      }
  } else {
      console.log("Invalid relation.");
  }
}

// 선택한 관계 받아오기
app.post('/relation', (req, res)=>{
  console.log(req.body);
  res.send("ok");
  relation = req.body['relation'];
  console.log(relation);
});

// 인원 분석한 결과값을 서버에 출력
app.post('/personcount', (req, res)=>{      
  res.sendFile(__dirname + '/public/broadcast.html');
  var info= req.body;
  io.emit('messageFromServer', info);           
  console.log(info)
  human_count = info['count']; // 값으로 받은 인원수를 전역변수에 저장

  // 포즈 선택
  selectPose(relation, human_count);

  // 선택된 폴더가 유효한지 확인
  if (selected_photolist !== '') {

    pose_recommendation_list = []; // 포즈를 다시 추천하기 위해 배열 초기화

    // 폴더 경로 설정 (selectPose 호출 후 설정)
    const folderPath = path.join(__dirname, 'public/example', selected_photolist); 

    // 폴더 내 파일 목록 읽기
    fs.readdir(folderPath, (err, files) => {
      if (err) {//폴더안의 내용 읽기 실패
        console.error("Error reading folder:", err);
        return;
      }

      // 이미지 파일만 필터링하여 처리
      files.filter(isImage).forEach(file => { //filter 를 이용해서 해당 디렉토리의 이미지 파일의 경로를 filePath에 저장

        // 클라이언트에서는 절대경로부터의 접근을 인식못해서 상대경로로 설정
        const relativePath = path.join('example', selected_photolist, file);
        console.log("Image file path:", relativePath);

        // 추가 이미지 처리 작업
        pose_recommendation_list.push(relativePath); // 주소를 정리해서 보내기 위해 배열에 저장
      });
    });

    isWorkDone = true;

  } else {
    console.log("No people detected or invalid folder."); // 0명 일때
    pose_recommendation_list = []; // 포즈를 다시 추천하기 위해 배열 초기화
    isWorkDone = true;
  }
});

// 정정한 인원수 받아온 후 관계와 함께 포즈 재설정
app.post('/rechecked_personcount', (req, res)=>{
  res.send("ok");
  human_count = req.body['rechecked_personcount'];

  selectPose(relation, human_count);

  // 선택된 폴더가 유효한지 확인
  if (selected_photolist !== '') {

    pose_recommendation_list = []; // 포즈를 다시 추천하기 위해 배열 초기화

    // 폴더 경로 설정 (selectPose 호출 후 설정)
    const folderPath = path.join(__dirname, 'public/example', selected_photolist); // folderPath에 /현재 디렉토리/example/solo(위에서 선택한 폴더)를 저장하고 있음

    // 폴더 내 파일 목록 읽기
    fs.readdir(folderPath, (err, files) => {
      if (err) {//폴더안의 내용 읽기 실패
        console.error("Error reading folder:", err);
        return;
      }

      // 이미지 파일만 필터링하여 처리
      files.filter(isImage).forEach(file => { //filter 를 이용해서 해당 디렉토리의 이미지 파일의 경로를 filePath에 저장

        // 클라이언트에서는 절대경로부터의 접근을 인식못해서 상대경로로 설정
        const relativePath = path.join('example', selected_photolist, file);
        console.log("Image file path:", relativePath);

        // 추가 이미지 처리 작업
        pose_recommendation_list.push(relativePath); // 주소를 정리해서 보내기 위해 배열에 저장
      });
    });



  } else {
    console.log("No people detected or invalid folder."); // 0명 일때
    pose_recommendation_list = []; // 포즈를 다시 추천하기 위해 배열 초기화

  }
});

app.get("/GetPoseData", (req, res) => { 
  var data = { // 클라이언트에서 /GetPoseData 링크를 통해 Get요청을 하면 보내지는 데이터
    recommended_pose : pose_recommendation_list // 배열형태로 주소 목록 전달
  } 
  res.status(200).json(data) 
}); 


// 정확도 계산값 받아오기
const pose_accuracy_array = [];
app.post('/accuracy', (req, res)=>{           
  res.sendFile(__dirname + '/public/broadcast.html');
  var info= req.body;
  io.emit('messageFromServer', info);            
  console.log(info)
  accuracy_result = info['accuracy'];
  accuracy_count = info['photocount'];
  pose_accuracy_array[accuracy_count-1] = accuracy_result;
  console.log(pose_accuracy_array);
  
  isWorkDone = true;
});
app.get('/getAccuracyResult',(req, res)=>{
  res.send(pose_accuracy_array);
});

app.get("/GetPersonCount", (req, res)=>{
  var data = {
    person_count : human_count
  } 
  res.status(200).json(data) 
});
app.get("/GetRelation", (req, res)=>{
  var data = {
    relation_result : relation
  } 
  res.status(200).json(data) 
});


// 작업이 끝났는지 확인
let isWorkDone = false;
app.get("/checkIfWorkIsDone", (req, res) => { 
  res.send(isWorkDone)
  isWorkDone = false;
}); 





// main페이지가 열리면 변수 초기화
app.get("/resetVariable", (req, res) => { 
  res.send('resetVariable');

  selected_photolist = "";
  human_count = 0;
  relation = null;
  pose_recommendation_list = [];
}); 