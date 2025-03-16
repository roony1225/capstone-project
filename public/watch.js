const ipUrl = '192.168.45.125:9000';

let peerConnection;
const config = {
  iceServers: [
      { 
        "urls": "stun:stun.l.google.com:19302",
      }
  ]
};

const socket = io.connect('https://'+ipUrl);
const video = document.querySelector("video");

socket.on("offer", (id, description) => {
  console.log("1");
  peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
    console.log("2");
  };
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
      console.log("3", event.candidate);
    }
  };
});


socket.on("candidate", (id, candidate) => {
  console.log("4", candidate);
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(e => console.error(e));
});

socket.on("connect", () => {
  console.log("5");
  socket.emit("watcher");
});

socket.on("broadcaster", () => {
  console.log("6");
  socket.emit("watcher");
});

window.onunload = window.onbeforeunload = () => {
  console.log("7");
  socket.close();
  peerConnection.close();
};

var isPhotoAvailable = true;
const timer=["[ 3 ]","[ 2 ]","[ 1 ]",""]; //타이머 텍스트
var photocount = 0;
function imgCapture() {
  if(isPhotoAvailable) {
    isPhotoAvailable = false;
    //타이머 출력
    setTimeout(()=> {
      document.getElementById("text-overlay").style.display = 'flex';
      document.getElementById("text-overlay").innerText = timer[0];
    },0); //바로 3출력
    setTimeout(()=> {
      document.getElementById("text-overlay").innerText = timer[1];
    },1000); //1초후 2출력
    setTimeout(()=> {
      document.getElementById("text-overlay").innerText = timer[2];
    },2000); //2초후 1출력
    setTimeout(()=> {
      document.getElementById("text-overlay").style.display = 'none';
      photocount++;
      takePhoto();

      document.getElementById("text-overlay").innerText = timer[3];
      isPhotoAvailable = true;
    },3000); //3초후 찰칵    
  }
  else {
    console.log("WAIT"); //촬영중에 캡처버튼 누르면 경고장 출력
  }
}

// 사진 찍기 함수
let poseName = 'NULL'
async function takePhoto() {
  // 프레임 촬영
  var imgUrlList = [];
  const imageGrid = document.getElementById(`sns`);
  const childElement = document.createElement('canvas');

  childElement.width = 640;
  childElement.height = 480;

  const context = childElement.getContext('2d');
  context.scale(-1 * childElement.width/640, childElement.height/480);
  context.drawImage(video, 0, 0, -1 * 640, 480);

  imgUrlList.push(childElement.toDataURL(`image${photocount}/png`));

  imageGrid.appendChild(childElement);
  document.getElementById('sns-image').remove();
  imageGrid.appendChild(childElement);
  childElement.setAttribute('id', `sns-image`);
  

  if(chosen_pose_Data != 'NULL'){
    poseName = get_pose_name(chosen_pose_Data);
  }

  axios.post(`https://${ipUrl}/ImageUrl${photocount}`, {
    'imgUrlList' : imgUrlList,
    'poseData' : poseName,
    'photoCount' : photocount
  })
  .then(response => {
    console.log(response);
  });

  // 정확도 출력 부분
  await loadingScreen();
  axios.get(`https://${ipUrl}/getAccuracyResult`).then(response =>{
    accuracy_array = response.data;
    const accuracyText = document.getElementById('acc-result');
    if(accuracy_array[photocount-1] == 'NULL'){
      accuracy_array[photocount-1] = "";
    }
    accuracyText.textContent = `${accuracy_array[photocount-1]}`;
  });

  if(photocount == 4) {
    window.open("imgdownload.html","_self");
  }
}

// python 실행을 위해 서버로 신호 전송
function sendSignal(){
  saveFrame();
  var modal = document.getElementById("modal_reconfirm_relation");
  modal.style.display = "block";

  if(document.getElementById('modal_preText')){
    document.getElementById('modal_preText').remove();
  }
}

var relation = null;
function checkRelation(num) {
    relation = num;
}
async function sendRelation() {
  if(relation == null){
    alert('관계를 선택해주세요!');
  }
  else {
    axios.post(`https://${ipUrl}/relation`, {
        'relation' : relation
    }, {
    })
    .then(response => {
        console.log(response);
    });
    axios.post(`https://${ipUrl}/signal`, {
      'signal' : 'Counting'
    }, {
    })
    .then(response => {
      console.log(response);
    });
    var modal = document.getElementById("modal_reconfirm_relation");
    modal.style.display = "none";

    await loadingScreen();

    axios.get(`https://${ipUrl}/GetPersonCount`).then(response =>{
      person_count = response.data.person_count;

      // 인원 출력용
      var person_count_html = document.getElementById("person_count");
      person_count_html.innerText = `Number of People: ${person_count}`;

      // 인원 재확인 용
      var recheck_personcount = document.getElementById("recheck_personcount");
      recheck_personcount.innerText = `Number of People: ${person_count}`;
    });
    axios.get(`https://${ipUrl}/GetRelation`).then(response =>{
      relation_result = response.data.relation_result;
      var relation_result_text = 'NULL';
      switch (relation_result) {
        case 0:
          relation_result_text = 'Solo';
          break;
        case 1:
          relation_result_text = 'Friends';
          break;
        case 2:
          relation_result_text = 'Lovers';
          break;
        case 3:
          relation_result_text = 'Family';
          break;
        case 4:
          relation_result_text = 'Group';
          break;
      }
      var relation_result_html = document.getElementById("relation_result");
      relation_result_html.innerText = `Relation: ${relation_result_text}`;
    });

    recheckPersonCount();
  }
}

// 인원수 다시 확인을 위한 모델창 띄우기
function recheckPersonCount(){
  var modal_recheck_personcount = document.getElementById('modal_recheck_personcount');
  modal_recheck_personcount.style.display = 'block';
}
function closeRecheckModal(){ // 인원이 맞으면
  var modal_recheck_personcount = document.getElementById('modal_recheck_personcount');
  modal_recheck_personcount.style.display = 'none';
}
function inputPersoncount(){ // 인원이 다르면
  var modal_recheck_personcount_button_section = document.getElementById('modal_recheck_personcount_button_section');
  modal_recheck_personcount_button_section.style.display = 'none';

  var input_personcount_section = document.getElementById('input_personcount_section');
  input_personcount_section.style.display = 'block';
}
function submitInputPersoncountData(){ // 정정한 인원 제출용
  closeRecheckModal();
  var modal_recheck_personcount_button_section = document.getElementById('modal_recheck_personcount_button_section');
  modal_recheck_personcount_button_section.style.display = 'flex';

  var input_personcount_section = document.getElementById('input_personcount_section');
  input_personcount_section.style.display = 'none';

  var input_personcount = parseInt(document.getElementById('input_personcount').value);
  var person_count_html = document.getElementById("person_count");
  person_count_html.innerText = `Number of People: ${input_personcount}`;
  axios.post(`https://${ipUrl}/rechecked_personcount`, {
    'rechecked_personcount' : input_personcount
  });
  document.getElementById('input_personcount').value = "";
}



// 파이썬 실행 버튼 누르면 프레임 서버로 전송해서 로컬에 저장하기
function saveFrame(){
  const childElement = document.createElement('canvas');
  childElement.width = 640;
  childElement.height = 480;
  const context = childElement.getContext('2d');
  context.drawImage(video, 0, 0, childElement.width, childElement.height);

  // Canvas의 내용을 JPEG로 변환
  childElement.toBlob(blob => {
    if (blob) {
      const reader = new FileReader();
      reader.onload = function() {
        const arrayBuffer = reader.result;
        // 데이터를 서버에 전송
        socket.emit('videoData', arrayBuffer);
      };
      reader.readAsArrayBuffer(blob);
    }
  }, 'image/jpeg', 0.9); // JPEG 형식으로 변환
}




// 서버에서 받은 인원수와 관계정보 확인 및 추가 수정
function getPoseData(){
  // 기존 추가된 포즈 버튼들 삭제
  let removeBtn = document.getElementsByClassName('pose-Button');
  if (removeBtn.length > 0){
    Array.from(removeBtn).forEach(btn => btn.remove());
  }

  // 선택된 포즈 데이터들 서버에서 읽어오기
  axios.get(`https://${ipUrl}/GetPoseData`).then(response =>{
    pose_Data = response.data;
    
    count = 0;
    pose_Data['recommended_pose'].forEach( index =>{
      addPose(index, count); // 포즈사진 추가하기
      count++;
    });
  });
}

// 이미지를 팝업창에 추가하는 방식
function addPose(index, count){
  let addBtn = document.createElement('btn');
  let addImg = document.createElement('img');
  addImg.src = index;
  document.getElementById('modal-body').appendChild(addBtn);
  addBtn.setAttribute('id', `pose-Button${count}`);
  addBtn.setAttribute('class', 'pose-Button');
  addBtn.setAttribute('onclick', `choose_Pose(${count})`)
  document.getElementById(`pose-Button${count}`).appendChild(addImg);
  addImg.setAttribute('id', 'pose-Image');
  addImg.setAttribute('class', 'pose-Image');
}



// 추천한 포즈 선택 함수
let chosen_pose_Data = 'NULL'; // 서버로 전송할 포즈정보
function choose_Pose(count){

  // 이미 선정한 포즈가 있으면 제거
  let removeElement = document.getElementById('selected-pose');
  if (removeElement){
    removeElement.remove()
  }
  let checkresetButton = document.getElementById('btn-resetPose');
  let addResetButton = document.createElement('img');
  if (!(checkresetButton)) {
    document.getElementById('removebtn-section').appendChild(addResetButton);
    addResetButton.setAttribute('src', 'images/cancel.png');
    addResetButton.setAttribute('id', 'btn-resetPose');
    addResetButton.setAttribute('class', 'btn-middle-right');
    addResetButton.setAttribute('onclick', 'resetPose()');
  }

  axios.get(`https://${ipUrl}/GetPoseData`).then(response =>{
    pose_Data = response.data;
    chosen_pose_Data = pose_Data['recommended_pose'][count]; // 선택한 포즈정보를 서버로 전송하기 위해 변수 저장

    let addImg = document.createElement('img');
    addImg.src = pose_Data['recommended_pose'][count];
    document.getElementById('display-selected-pose').appendChild(addImg);
    addImg.setAttribute('id', 'selected-pose');
  });
}

// 포즈 선택 취소
function resetPose(){
  chosen_pose_Data = 'NULL';
  poseName = 'NULL';
  if(document.getElementById('selected-pose')) {
    document.getElementById('selected-pose').remove();
  }
  document.getElementById('btn-resetPose').remove();
}

function get_pose_name(file_path_name) {
  filePath = file_path_name;
  fileName = filePath.split('\\').pop();
  const nameWithoutExtension = fileName.split('.').slice(0, -1).join('.');
  return nameWithoutExtension;
}



async function checkIfWorkIsDone(){
  return new Promise((resolve) => {
    setTimeout(()=> {
      axios.get(`https://${ipUrl}/checkIfWorkIsDone`).then(response =>{
        isWorkDone = response.data;
        console.log(isWorkDone)
        if(isWorkDone == false){
          return resolve(checkIfWorkIsDone());
        }

        resolve();
      });
    },1000);
  });
}
async function loadingScreen(){
  return new Promise(async (resolve) => {
    var modal_loading = document.getElementById("modal_loading");
    modal_loading.style.display = "block";
    await checkIfWorkIsDone();
    modal_loading.style.display = "none";

    resolve();
  });
}


// 팝업창 관리
document.addEventListener("DOMContentLoaded", function() {
  // Get the modal
  var modal = document.getElementById("myModal");
  var btn = document.getElementById("myBtn");
  var span = document.getElementsByClassName("close")[0];
  btn.onclick = function() {
    getPoseData();
    modal.style.display = "block";
  }

  // When the user clicks on <span> (x), close the modal
  span.onclick = function() {
    modal.style.display = "none";
  }

  var help_modal = document.getElementById("modal_help");
  var help_button = document.getElementById("help_button");
  var help_close = document.getElementById("help_close");
  help_button.onclick = function() {
    help_modal.style.display = "block";
  }
  help_close.onclick = function() {
    help_modal.style.display = "none";
  }


  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {

    resetTimer();

    if (event.target == modal) {
        modal.style.display = "none";
    }
  }
});

let screenTimer;
let alertTimer;
const delay = 120000;

function startTimer() {
  screenTimer = setTimeout(function() {
    window.open("main.html","_self");
  }, delay);
  
  alertTimer = setTimeout(function() {
    alert('30초 내로 동작이 없을 시 종료됩니다.')
  }, delay-30000);
  
}

// 타이머 초기화 함수
function resetTimer() {
  clearTimeout(screenTimer); // 기존 타이머 취소
  clearTimeout(alertTimer);
  startTimer(); // 새 타이머 시작
}

startTimer();

// 서버의 변수 초기화
window.onload = () => {
  axios.get(`https://${ipUrl}/resetVariable`);
}