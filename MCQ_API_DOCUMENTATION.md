# MCQ API Endpoints

## Overview
The MCQ API handles the submission and retrieval of Multiple Choice Question (MCQ) responses for candidates during the assessment process.

## Base URL
```
/api/mcq
```

## Authentication
All MCQ endpoints require candidate authentication via JWT Bearer token in the Authorization header:
```
Authorization: Bearer <candidate_jwt_token>
```

---

## Endpoints

### 1. Submit MCQ Answer
**POST** `/api/mcq/submit`

Submit a single MCQ answer for a specific question.

#### Request Headers
```
Authorization: Bearer <candidate_jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "question_id": 101,
  "answer_option": "b"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| question_id | integer | Yes | ID of the MCQ question |
| answer_option | string | Yes | Selected option (e.g., 'a', 'b', 'c', 'd') - max 10 chars |

#### Response (201 Created)
```json
{
  "success": true,
  "message": "MCQ answer submitted successfully",
  "data": {
    "id": 1,
    "question_id": 101,
    "candidate_id": 5,
    "answer_option": "b",
    "answered_at": "2024-02-04T10:30:00"
  }
}
```

#### Response (200 OK - Update Existing)
If the candidate has already answered this question, it will be updated:
```json
{
  "success": true,
  "message": "MCQ answer updated successfully",
  "data": {
    "id": 1,
    "question_id": 101,
    "candidate_id": 5,
    "answer_option": "c",
    "answered_at": "2024-02-04T10:35:00"
  }
}
```

#### Error Responses
```json
// 400 - Missing fields
{
  "success": false,
  "message": "question_id is required"
}

// 401 - Unauthorized
{
  "success": false,
  "message": "Authentication required"
}

// 404 - Candidate not found
{
  "success": false,
  "message": "Candidate not found"
}

// 500 - Server error
{
  "success": false,
  "message": "Failed to submit MCQ answer",
  "error": "Error details"
}
```

---

### 2. Batch Submit MCQ Answers
**POST** `/api/mcq/batch-submit`

Submit multiple MCQ answers at once. Useful for submitting all answers at the end of the MCQ round.

#### Request Headers
```
Authorization: Bearer <candidate_jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "answers": [
    {
      "question_id": 101,
      "answer_option": "b"
    },
    {
      "question_id": 102,
      "answer_option": "a"
    },
    {
      "question_id": 103,
      "answer_option": "c"
    }
  ]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "3 MCQ answer(s) submitted successfully",
  "data": [
    {
      "id": 1,
      "question_id": 101,
      "candidate_id": 5,
      "answer_option": "b",
      "answered_at": "2024-02-04T10:30:00"
    },
    {
      "id": 2,
      "question_id": 102,
      "candidate_id": 5,
      "answer_option": "a",
      "answered_at": "2024-02-04T10:30:00"
    },
    {
      "id": 3,
      "question_id": 103,
      "candidate_id": 5,
      "answer_option": "c",
      "answered_at": "2024-02-04T10:30:00"
    }
  ]
}
```

#### Error Responses
```json
// 400 - Invalid request
{
  "success": false,
  "message": "answers must be a non-empty array"
}
```

---

### 3. Get All MCQ Responses
**GET** `/api/mcq/responses`

Retrieve all MCQ responses submitted by the authenticated candidate.

#### Request Headers
```
Authorization: Bearer <candidate_jwt_token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "question_id": 101,
      "candidate_id": 5,
      "answer_option": "b",
      "answered_at": "2024-02-04T10:30:00"
    },
    {
      "id": 2,
      "question_id": 102,
      "candidate_id": 5,
      "answer_option": "a",
      "answered_at": "2024-02-04T10:32:00"
    }
  ]
}
```

---

### 4. Get MCQ Response by Question
**GET** `/api/mcq/responses/<question_id>`

Retrieve the candidate's response for a specific question.

#### Request Headers
```
Authorization: Bearer <candidate_jwt_token>
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| question_id | integer | ID of the question |

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "question_id": 101,
    "candidate_id": 5,
    "answer_option": "b",
    "answered_at": "2024-02-04T10:30:00"
  }
}
```

#### Response (404 Not Found)
```json
{
  "success": false,
  "message": "No response found for this question"
}
```

---

## Database Model

### MCQResponse Table (`mcq_responses`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique response ID |
| question_id | INTEGER | NOT NULL | ID of the MCQ question |
| candidate_id | INTEGER | NOT NULL, FOREIGN KEY → candidate_auth.id | Reference to candidate |
| answer_option | VARCHAR(10) | NOT NULL | Selected answer option |
| answered_at | TIMESTAMP | NOT NULL, DEFAULT NOW | When answer was submitted |

### Relationships
- **candidate_id** → Foreign key to `candidate_auth.id`
- Each candidate can have multiple MCQ responses (one per question)
- Unique constraint: (question_id, candidate_id) - prevents duplicate answers

---

## Usage Examples

### Frontend Integration

#### Submit Single Answer
```typescript
const submitMCQAnswer = async (questionId: number, answerOption: string) => {
  const token = localStorage.getItem('candidate_token');
  
  const response = await fetch('http://localhost:5000/api/mcq/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      question_id: questionId,
      answer_option: answerOption
    })
  });
  
  const data = await response.json();
  return data;
};

// Usage
await submitMCQAnswer(101, 'b');
```

#### Batch Submit at Round End
```typescript
const submitAllMCQAnswers = async (answers: Array<{question_id: number, answer_option: string}>) => {
  const token = localStorage.getItem('candidate_token');
  
  const response = await fetch('http://localhost:5000/api/mcq/batch-submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ answers })
  });
  
  return await response.json();
};

// Usage
await submitAllMCQAnswers([
  { question_id: 101, answer_option: 'b' },
  { question_id: 102, answer_option: 'a' },
  { question_id: 103, answer_option: 'c' }
]);
```

#### Retrieve All Responses
```typescript
const getMCQResponses = async () => {
  const token = localStorage.getItem('candidate_token');
  
  const response = await fetch('http://localhost:5000/api/mcq/responses', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

---

## Workflow Integration

### MCQ Round Workflow
1. Candidate completes resume upload
2. Candidate starts assessment (MCQ round)
3. For each MCQ question:
   - Display question and options
   - On answer selection → Call `POST /api/mcq/submit`
   - Store response in database
   - Allow answer changes (updates existing response)
4. After completing all MCQ questions:
   - Optionally call `POST /api/mcq/batch-submit` to ensure all answers are saved
   - Move to next round (Psychometric)

### Answer Persistence
- Answers are saved immediately upon selection
- If candidate navigates back, existing answer is loaded via `GET /api/mcq/responses/<question_id>`
- Answers can be updated multiple times before round completion
- Final timestamp reflects the last update

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful (GET or UPDATE) |
| 201 | Created - New response created |
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid token |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

---

## Notes

- **Idempotency**: Submitting the same answer multiple times updates the existing record
- **Real-time Saving**: Answers should be submitted as soon as selected (auto-save)
- **Navigation Support**: Candidates can navigate between questions, answers are preserved
- **Validation**: Frontend should validate answer_option format before submission
- **Timestamp**: Server-side timestamp ensures accurate timing information
