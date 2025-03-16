IPURL='192.168.45.125:9000'
import time
import os

import cv2
import numpy as np
import threading
import requests

import json
import torch
import torchvision.transforms as T
from torchvision.models.detection import keypointrcnn_resnet50_fpn
from scipy.optimize import linear_sum_assignment
from scipy.spatial.distance import euclidean, cosine

import base64
from io import BytesIO
from PIL import Image
import matplotlib.pyplot as plt

command_file = 'command/command.txt'
# 커맨드파일
# 1번째 줄: 명령
# 2번째 줄: 인원
# 3번째 줄: 관계
# 4번째 줄: 선택한 포즈
# 5번째 줄: 찍은 사진 데이터

def read_command_file(file_path):
    if os.path.exists(file_path):
        with open(file_path, 'r') as file:
            lines = file.readlines()
            return lines
    return None

def reset_command_file(file_path):
    if os.path.exists(file_path):
        with open(file_path, 'w') as file:
            file.write('ready')
    return None

def main():
    last_command = ''

    print(f"Monitoring file: {command_file}")
    
    while True:
        current_command = read_command_file(command_file)
        first_line = current_command[0].strip() # 커맨드 파일 첫번째줄읽기
        # print(f"Current command: {current_command}")  # 디버그 출력

        if current_command and first_line != last_command:
            print(f"New command received: {first_line}")
            last_command = first_line

            if first_line == 'start_counting':
                print("Counting person")
                humanDetector(args)

            elif first_line == 'calculate_pose_accuracy':
                print("Calculating pose accuracy")

                # Constants
                OUTPUT_WIDTH = 640
                OUTPUT_HEIGHT = 480

                max_people = current_command[1].strip() #인원수 읽기
                max_people = int(max_people) #인원수 str을 int로 변환
                chosen_relationship = current_command[2].strip() #관계 읽기
                chosen_pose = current_command[3].strip() #선택한 포즈 읽기
                taken_image_path = current_command[4].strip() #촬영한 사진 데이터 읽기
                taken_image_path = decode_taken_image(taken_image_path) #촬영한 사진 디코딩 작업
                photocount = current_command[5].strip()

                if (chosen_pose == 'NULL'): # 포즈를 선택 안 했을때
                    print('Pose Was Not Chosen')
                    AccOfPose_URL = 'https://'+IPURL+'/accuracy'
                    obj = {'accuracy':'NULL', 'photocount':photocount}
                    submit_form(AccOfPose_URL, obj) # 서버로 결과값 전송

                else: # 포즈를 선택 했을때
                    json_path = os.path.join("example", chosen_relationship, "pose_jsons", f"{chosen_pose}.json")

                    json_pose_data = load_pose_data(json_path)

                    extracted_pose_data = extract_pose_from_image(taken_image_path, max_people, OUTPUT_WIDTH, OUTPUT_HEIGHT)

                    # 계산 하는 함수
                    average_accuracy, accuracy_matrix, row_ind, col_ind = compare_poses_with_optimal_matching(json_pose_data, extracted_pose_data)

                    print(f"Accuracy Matrix:\n{accuracy_matrix}") # 각 사람들 끼리의 정확도 계산을 matrix형태로 출력
                    print(f"Optimal Matching (JSON -> Extracted): {list(zip(row_ind, col_ind))}") #matrix에서 최종적으로 무엇들을 결정해서 가장 정확도가 높게 나왔는지

                    print(f"Average Accuracy: {average_accuracy * 100:.2f}%")# 최종정확도 출력

                    result = float(f"{average_accuracy * 100:.2f}")

                    AccOfPose_URL = 'https://'+IPURL+'/accuracy'
                    obj = {'accuracy':result,'photocount':photocount}
                    submit_form(AccOfPose_URL, obj) # 서버로 결과값 전송

        last_command = 'ready'
        if first_line != 'ready':
            reset_command_file(command_file)
            print("RESET")

        time.sleep(1)  # 1초마다 파일을 확인


#]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]
# 인원 분석

def submit_form(url, obj):
    try:  
        resp = requests.post(url, json = obj, verify=False)
        resp.raise_for_status()
        print('Data sent successfully')
    except requests.exceptions.RequestException as e:
        print('Error sending data:', e)

# 변수들을 전역으로 설정
lock = threading.Lock()
person_count = 0

# YOLO 모델 파일 경로
config_path = "PersonCountData/yolov3.cfg"
weights_path = "PersonCountData/yolov3.weights"
names_path = "PersonCountData/coco.names"

# 클래스 이름 로드
with open(names_path, "r") as f:
    classes = [line.strip() for line in f.readlines()]

# 네트워크 초기화
net = cv2.dnn.readNet(weights_path, config_path)

# 레이어 이름 가져오기
layer_names = net.getLayerNames()
unconnected_layers = net.getUnconnectedOutLayers()

if isinstance(unconnected_layers, (list, np.ndarray)):
    if isinstance(unconnected_layers[0], (list, np.ndarray)):
        output_layers = [layer_names[i[0] - 1] for i in unconnected_layers]
    else:
        output_layers = [layer_names[i - 1] for i in unconnected_layers]
else:
    output_layers = [layer_names[unconnected_layers - 1]]

# 사람 주위에 상자 생성하는 detect 함수
def detect(frame):
    global person_count

    height, width, channel = frame.shape
    blob = cv2.dnn.blobFromImage(frame, 0.00392, (416, 416), (0, 0, 0), True, crop=False)
    net.setInput(blob)
    outs = net.forward(output_layers)

    class_ids = []
    confidences = []
    boxes = []

    for out in outs:
        for detection in out:
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.5 and classes[class_id] == 'person':
                center_x = int(detection[0] * width)
                center_y = int(detection[1] * height)
                w = int(detection[2] * width)
                h = int(detection[3] * height)
                x = int(center_x - w / 2)
                y = int(center_y - h / 2)

                boxes.append([x, y, w, h])
                confidences.append(float(confidence))
                class_ids.append(class_id)

    indexes = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.4)

    person = 1
    for i in range(len(boxes)):
        if i in indexes:
            x, y, w, h = boxes[i]
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2) #여기 cv2 부분은 모두 보여주기용
            cv2.putText(frame, f'person {person}', (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            person += 1

    cv2.putText(frame, 'Status : Detecting ', (40, 40), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 0, 0), 2)
    cv2.putText(frame, f'Total Persons : {person-1}', (40, 70), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 0, 0), 2)
    cv2.imshow('output', frame)#여기까지 

    with lock:
        person_count = person - 1

    return frame, person - 1



#---------------------------------------------------------

# 저장된 영상을 가지고 작동할 경우
def detectByPathVideo(path,writer):
    image = cv2.imread(path)
    if image is None:
        print('Image Not Found. Please Enter a Valid Path (Full path of Image Should be Provided).')
        return

    print('Detecting people in the image...')

    image = cv2.imread(path)
    image = detect(image)

    cv2.destroyAllWindows()

#---------------------------------------------------------

# 다른 작업을 실행하는 함수 (예: 인원수에 따라 다른 코드 실행)
def otherTask():
    global person_count
    with lock:
        print(f"Current person count: {person_count}")
        NumOfPeople_URL = 'https://'+IPURL+'/personcount'
        obj = {'count':person_count}
        submit_form(NumOfPeople_URL, obj) # 서버로 결과값 전송

def humanDetector(args):
    video_path = args["video"]
    camera = args["camera"] == 'True'
    
    writer = None
    if args['output'] is not None:
        writer = cv2.VideoWriter(args['output'], cv2.VideoWriter_fourcc(*'MJPG'), 10, (640, 480))

    if video_path is not None:
        detect_thread = threading.Thread(target=detectByPathVideo, args=(video_path, writer))
        other_thread = threading.Thread(target=otherTask)

        detect_thread.start()

        detect_thread.join() # detect랑 other_thread랑 같이 하면 처음에 결과가 0이 나오다가 계산 완료후 값을 보냄 > 그래서 detect가 끝나면 other가 실행되게 해서 값을 바로 보내게하면 어떨까
        other_thread.start()

        other_thread.join()
    
    else:
        print("Please provide a valid camera input or video path.")

# 인원분석 실행
image_path = 'images/received_image.jpg'
args = {"camera": 'None', "video": image_path, "output": None}  # video에 video 주소 입력 #output은 결과물 저장

#]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]

#]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]
# 포즈 정확도 계산

# 촬영한 사진 디코딩작업
def decode_taken_image(data):
    base64_data = data.split(',')[1]
    image_data = base64.b64decode(base64_data)
    image = Image.open(BytesIO(image_data))
    image_np = np.array(image)
    image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    return image_cv

# Load the reference pose from the JSON file
def load_pose_data(json_path):
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"JSON file not found: {json_path}")
    
    with open(json_path, 'r') as f:
        pose_data = json.load(f)
    
    return pose_data

#extract pose
def extract_pose_from_image(image_path, max_people, OUTPUT_WIDTH, OUTPUT_HEIGHT):
    # Load the image
    #img = cv2.imread(image_path)
    img = image_path
    if img is None:
        raise FileNotFoundError("Image not found or unable to open: {}".format(image_path))
    
    # Resize the image to the fixed output size
    img = cv2.resize(img, (OUTPUT_WIDTH, OUTPUT_HEIGHT))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_tensor = T.ToTensor()(img).cuda()
    
    # Load the pretrained Keypoint R-CNN model
    model = keypointrcnn_resnet50_fpn(weights='KeypointRCNN_ResNet50_FPN_Weights.COCO_V1').cuda()
    model.eval()
    
    # Perform inference
    with torch.no_grad():
        predictions = model([img_tensor])
    
    pose_data = []
    person_count = 0  # 추출한 사람 수 카운트
    
    for i, label in enumerate(predictions[0]['labels']):
        if label == 1:  # Person class
            keypoints = predictions[0]['keypoints'][i].cpu().numpy().tolist()
            pose_data.append(keypoints)
            person_count += 1
            if person_count >= max_people:  # 설정한 사람 수에 도달하면 중단
                break
    
    return pose_data

EXCLUDE_KEYPOINTS = [0, 1, 2, 3, 4]  # 코, 왼쪽 눈, 오른쪽 눈, 왼쪽 귀, 오른쪽 귀는 정확도를 계산하지 않도록 구현

# directional_accuracy(방향 기반 정확도) => 거리가 아닌 각도를 기반으로 한 정확도 계산
def create_keypoint_vectors(keypoints):
    # keypoints들로 백터들 생성 하는 함수
    filtered_keypoints = [kp for i, kp in enumerate(keypoints) if i not in EXCLUDE_KEYPOINTS]
    vectors = []
    # keypoints들로 백터들 생성
    for i in range(len(filtered_keypoints) - 1):
        vec = [filtered_keypoints[i + 1][0] - filtered_keypoints[i][0], filtered_keypoints[i + 1][1] - filtered_keypoints[i][1]]
        vectors.append(vec)
    return vectors

# 각각의 벡터들로 cosine similarity를 계산
def calculate_directional_accuracy(pose1, pose2):
    vectors1 = create_keypoint_vectors(pose1)
    vectors2 = create_keypoint_vectors(pose2)

    if len(vectors1) != len(vectors2):
        return 0.0  # 키포인트 벡터 개수가 다르면 0

    total_similarity = 0.0
    for v1, v2 in zip(vectors1, vectors2):
        # Calculate cosine similarity
        total_similarity += 1 - cosine(v1, v2)  # 1 - cosine distance gives similarity

    return total_similarity / len(vectors1) if vectors1 else 0.0  # 벡터의 평균 유사도 반환

# 미리 추출한 json과 현재 추출한 데이터의 정확도 계산
def compare_poses_with_optimal_matching(json_poses, extracted_poses):
    num_json_people = len(json_poses)
    num_extracted_people = len(extracted_poses)
    
    # 각 사람간의 정확도 점수를 저장할 accuracy_matrix생성
    accuracy_matrix = np.zeros((num_json_people, num_extracted_people))

    for i, json_pose in enumerate(json_poses):
        for j, extracted_pose in enumerate(extracted_poses):

            directional_accuracy = calculate_directional_accuracy(json_pose, extracted_pose) # 각도기반 정확도

            if np.isnan(directional_accuracy) or np.isinf(directional_accuracy): #cos 값이 NaN(영벡터가 있을경우 값이 나오지 않음), Inf(무한대값)이 나오는것을 0으로 처리
                directional_accuracy = 0.0

            # Combine the accuracies (현재는 directional_accuracy만 사용)
            accuracy_matrix[i, j] =  directional_accuracy
    
    # 중복없이 1대1 매칭을 위해 Hungarian algorithm을 사용
    row_ind, col_ind = linear_sum_assignment(-accuracy_matrix)  # Minimize -accuracy to maximize accuracy
    
    # 최종 정확도 계산
    total_accuracy = accuracy_matrix[row_ind, col_ind].sum()

    average_accuracy = total_accuracy / len(row_ind) if row_ind.size > 0 else 0.0 

    if(average_accuracy < 0):
        average_accuracy = 0.0
    
    return average_accuracy, accuracy_matrix, row_ind, col_ind

#]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]

# 파이썬 실행시
if __name__ == '__main__':
    reset_command_file(command_file) # 커멘드 파일 초기화
    main()