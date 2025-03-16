# 각도만으로 정확도를 계산하는 버전

#각 사진간의 사람들이 중복없이 1대1 매칭으로 정확도 계산하여 가장 점수가 높게 나올때의 점수를 출력하도록 구현 하였음
import os
import numpy as np
import cv2
import json
import torch
import torchvision.transforms as T
from torchvision.models.detection import keypointrcnn_resnet50_fpn
from scipy.optimize import linear_sum_assignment
from scipy.spatial.distance import euclidean, cosine

# Constants
OUTPUT_WIDTH = 640
OUTPUT_HEIGHT = 480

chosen_relationship = "group3"  # Java에서 파일을 받아 입력 (선택한 관계)
chosen_pose = "group3 (6)"  # Java에서 파일을 받아 입력 (선택한 포즈) # 확장명이 .jpg이어선 안된다
max_people = 3  # Java에서 파일을 받아 입력 (선택한 인원 수)

image_path = "test/test3.jpg"  # 비교할 이미지 파일 경로

chosen_pose_image_path = os.path.join("example", chosen_relationship, f"{chosen_pose}.jpg")
json_path = os.path.join("example", chosen_relationship, "pose_jsons", f"{chosen_pose}.json")

# Load the reference pose from the JSON file
def load_pose_data(json_path):
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"JSON file not found: {json_path}")
    
    with open(json_path, 'r') as f:
        pose_data = json.load(f)
    
    return pose_data

#extract pose
def extract_pose_from_image(image_path, max_people):
    # Load the image
    img = cv2.imread(image_path)
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

            # Combine the accuracies (현재는 directional_accuracy만 사용)
            accuracy_matrix[i, j] =  directional_accuracy
    
    # 중복없이 1대1 매칭을 위해 Hungarian algorithm을 사용
    row_ind, col_ind = linear_sum_assignment(-accuracy_matrix)  # Minimize -accuracy to maximize accuracy
    
    # 최종 정확도 계산
    total_accuracy = accuracy_matrix[row_ind, col_ind].sum()

    average_accuracy = total_accuracy / len(row_ind) if row_ind.size > 0 else 0.0
    
    return average_accuracy, accuracy_matrix, row_ind, col_ind


json_pose_data = load_pose_data(json_path)
# print(f"Reference pose for : {json_pose_data}")  # 가져온 데이터 Test용 출력문구

extracted_pose_data = extract_pose_from_image(image_path, max_people)

# 추출한 데이터 test용 출력문구
# print("Extracted reference poses:") 
# for pose in extracted_pose_data:
#     print(pose)

# 계산 하는 함수
average_accuracy, accuracy_matrix, row_ind, col_ind = compare_poses_with_optimal_matching(json_pose_data, extracted_pose_data)

print(f"Accuracy Matrix:\n{accuracy_matrix}") # 각 사람들 끼리의 정확도 계산을 matrix형태로 출력
print(f"Optimal Matching (JSON -> Extracted): {list(zip(row_ind, col_ind))}") #matrix에서 최종적으로 무엇들을 결정해서 가장 정확도가 높게 나왔는지

print(f"Average Accuracy: {average_accuracy * 100:.2f}%")# 최종정확도 출력