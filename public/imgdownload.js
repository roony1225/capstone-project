const ipUrl = '192.168.45.125:9000';

window.onload = () => {
    let width = (window.innerWidth - 140) / 2;
    let height = Math.floor(0.75 * width);

    let indexList = [1, 2, 3, 4];
    indexList.forEach((i)=>{
      let imgUrl;
      axios.get(`https://${ipUrl}/ImageUrl${i}`).then(response =>{
        imgUrl = response.data[0];
        // console.log(imgUrl);

        const imageSection = document.getElementById(`image-section${i}`);
        const childElement = document.createElement('img');
        childElement.setAttribute('id', `img${i}`)
        childElement.src = imgUrl;
        childElement.width = width*1.2;
        childElement.height = height*1.2;
        imageSection.appendChild(childElement);
        console.log(childElement);
      });
    });

    // 정확도 가져오기
    axios.get(`https://${ipUrl}/getAccuracyResult`).then(response =>{
        accuracy_array = response.data;
        for (let i = 0; i < 4; i++){
          const accuracy = document.getElementById(`accuracy-result${i+1}`);
          if(accuracy_array[i] == "NULL") {
            accuracy.innerText = "No Pose Selected";
          }
          else if(accuracy_array[i] >= 90) {
            accuracy.innerText = `Perfect!!! (${accuracy_array[i]}%)`;
          }
          else if(accuracy_array[i] >= 80) {
            accuracy.innerText = `Excellant! (${accuracy_array[i]}%)`;
          }
          else if(accuracy_array[i] >= 50) {
            accuracy.innerText = `Good! (${accuracy_array[i]}%)`;
          }
          else if(accuracy_array[i] >= 20) {
            accuracy.innerText = `SoSo (${accuracy_array[i]}%)`;
          }
          else {
            accuracy.innerText = `Try Harder (${accuracy_array[i]}%)`;
          }
        }
    });
};

var photoselect;
var checkedCount = 0;
var checkedBoxList = [0,0,0,0]; // 0 = 선택X, 1 = 선택O
function photochoose(i) {
  checkCheckbox(i);

  photoselect = i;
  let width = (window.innerWidth) / 1.05;
  let height = Math.floor(0.75 * width);

  let imgUrl;
  axios.get(`https://${ipUrl}/ImageUrl${i}`).then(response =>{
      imgUrl = response.data[0];

      const imageSection = document.getElementById(`img-preview`);
      imageSection.src = imgUrl;
      imageSection.width = width;
      imageSection.height = height;
  });
};
function checkCheckbox(i) {
  var checkbox = document.getElementById(`cb${i}`);
  if (checkedBoxList[i-1] == 0){
    checkedCount++;
    checkedBoxList[i-1] = 1;
    checkbox.style.display = 'block';
  }
  else {
    checkedCount--;
    checkedBoxList[i-1] = 0;
    checkbox.style.display = 'none';
  }
}

//이미지 다운로드 버튼
document.getElementById('download-btn').addEventListener('click', function() {
  const link = document.createElement('a');
  if(checkedCount == 0){
    alert('Please select the photo');
  }
  else{
    for(i=0; i<4; i++){
      if(checkedBoxList[i] == '1'){
        link.href = document.getElementById(`img${i+1}`).src;
        link.download = `downloaded_image${i+1}.png`;  // 다운로드될 파일명
        link.click();
      }
    }
  }
});

//Zip파일로 다운받기
function downloadSelectedImages() {
  const zip = new JSZip();
  const imageFolder = zip.folder("images");  // ZIP 파일 내 폴더 이름 설정
  const downloadPromises = [];
  if(checkedCount == 0){
    alert('Please select the photo');
  }
  else {
    for (let i = 0; i < 4; i++) {
      if (checkedBoxList[i] == '1') {
        const img = document.getElementById(`img${i + 1}`);
        const fileName = `downloaded_image${i + 1}.png`;
  
        // fetch API를 통해 이미지 파일을 가져옴
        const promise = fetch(img.src)
          .then(response => response.blob())
          .then(blob => {
            imageFolder.file(fileName, blob);  // ZIP 파일에 이미지 추가
          })
          .catch(error => console.error(`Error fetching image ${fileName}:`, error));
  
        downloadPromises.push(promise);
      }
    }
  
    // 모든 이미지가 준비된 후 ZIP 파일 생성
    Promise.all(downloadPromises).then(() => {
      zip.generateAsync({ type: "blob" })
        .then(zipFile => {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(zipFile);
          link.download = "images.zip";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
    });
  }
}


window.onclick = function(event) {
    resetTimer();
}

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