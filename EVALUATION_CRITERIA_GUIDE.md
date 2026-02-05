# Evaluation Criteria Feature

## Overview

The Evaluation Criteria feature allows recruiters to customize the weightage of different assessment parameters when evaluating candidates. This provides flexibility in scoring candidates based on organizational priorities.

## Features

### 1. **Customizable Evaluation Parameters**

Four key assessment parameters can be configured:

| Parameter | Description | Default Weightage |
|-----------|-------------|------------------|
| **Technical Skill** | MCQ and coding assessment scores | 50% |
| **Psychometric Assessment** | Personality and behavioral traits | 15% |
| **Soft Skills** | Text-based answers and communication | 15% |
| **Fairplay** | Proctoring violations and integrity | 20% |

### 2. **Validation Rules**

- All percentages must be between 0 and 100
- Total of all parameters must equal exactly 100%
- Real-time validation with visual feedback
- Server-side validation for data integrity

### 3. **Default Recommendations**

The system provides scientifically-backed default values based on industry best practices:
- Technical competence receives the highest weight (50%)
- Behavioral traits, communication skills, and integrity are equally important (15-20% each)

## Database Schema

### Table: `evaluation_criteria`

```sql
CREATE TABLE evaluation_criteria (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    recruiter_id INTEGER NOT NULL UNIQUE,
    technical_skill FLOAT NOT NULL DEFAULT 50.0,
    psychometric_assessment FLOAT NOT NULL DEFAULT 15.0,
    soft_skill FLOAT NOT NULL DEFAULT 15.0,
    fairplay FLOAT NOT NULL DEFAULT 20.0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (recruiter_id) REFERENCES recruiter_auth(id)
);
```

### Model Definition

```python
class EvaluationCriteria(db.Model):
    __tablename__ = 'evaluation_criteria'
    
    id = db.Column(db.Integer, primary_key=True)
    recruiter_id = db.Column(db.Integer, db.ForeignKey('recruiter_auth.id'), 
                            nullable=False, unique=True)
    technical_skill = db.Column(db.Float, nullable=False, default=50.0)
    psychometric_assessment = db.Column(db.Float, nullable=False, default=15.0)
    soft_skill = db.Column(db.Float, nullable=False, default=15.0)
    fairplay = db.Column(db.Float, nullable=False, default=20.0)
    is_default = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, 
                          onupdate=datetime.utcnow, nullable=False)
```

## API Endpoints

### 1. Get Evaluation Criteria

**Endpoint:** `GET /recruiter-dashboard/evaluation-criteria`

**Authentication:** Required (JWT Bearer token - recruiter only)

**Response:**
```json
{
  "success": true,
  "criteria": {
    "id": 1,
    "recruiter_id": 5,
    "technical_skill": 50.0,
    "psychometric_assessment": 15.0,
    "soft_skill": 15.0,
    "fairplay": 20.0,
    "is_default": true,
    "created_at": "2026-02-05T10:30:00",
    "updated_at": "2026-02-05T10:30:00"
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `403`: Forbidden (not a recruiter)
- `500`: Server error

---

### 2. Update Evaluation Criteria

**Endpoint:** `POST /recruiter-dashboard/evaluation-criteria` or `PUT /recruiter-dashboard/evaluation-criteria`

**Authentication:** Required (JWT Bearer token - recruiter only)

**Request Body:**
```json
{
  "technical_skill": 60.0,
  "psychometric_assessment": 10.0,
  "soft_skill": 20.0,
  "fairplay": 10.0
}
```

**Validation:**
- All fields are required
- Values must be between 0 and 100
- Sum must equal 100

**Response:**
```json
{
  "success": true,
  "message": "Evaluation criteria updated successfully",
  "criteria": {
    "id": 1,
    "recruiter_id": 5,
    "technical_skill": 60.0,
    "psychometric_assessment": 10.0,
    "soft_skill": 20.0,
    "fairplay": 10.0,
    "is_default": false,
    "created_at": "2026-02-05T10:30:00",
    "updated_at": "2026-02-05T11:45:00"
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Bad request (invalid data or percentages don't sum to 100)
- `401`: Unauthorized
- `403`: Forbidden (not a recruiter)
- `500`: Server error

---

### 3. Reset to Default Criteria

**Endpoint:** `POST /recruiter-dashboard/evaluation-criteria/reset`

**Authentication:** Required (JWT Bearer token - recruiter only)

**Response:**
```json
{
  "success": true,
  "message": "Evaluation criteria reset to defaults",
  "criteria": {
    "id": 1,
    "recruiter_id": 5,
    "technical_skill": 50.0,
    "psychometric_assessment": 15.0,
    "soft_skill": 15.0,
    "fairplay": 20.0,
    "is_default": true,
    "created_at": "2026-02-05T10:30:00",
    "updated_at": "2026-02-05T12:00:00"
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `403`: Forbidden (not a recruiter)
- `500`: Server error

## Frontend Implementation

### Location
`frontend/src/pages/admin/Settings.tsx`

### Components Used
- **Card**: Container for the evaluation criteria section
- **Table**: Display parameters and input fields
- **Input**: Number inputs for percentage values
- **Button**: Save and reset actions
- **Toast**: Success/error notifications

### Features

1. **Real-time Validation**
   - Live calculation of total percentage
   - Color-coded feedback (green when valid, red when invalid)
   - Disabled save button when total ≠ 100%

2. **Visual Feedback**
   - Badge showing "Using Defaults" when applicable
   - Recommended values displayed for reference
   - Loading states during API calls

3. **User Actions**
   - Edit individual parameter values
   - Save custom criteria
   - Reset to recommended defaults

### Example Usage

```tsx
// Fetch criteria on component mount
useEffect(() => {
  fetchEvaluationCriteria();
}, []);

// Update criteria
const handleSaveCriteria = async () => {
  const response = await fetch('/recruiter-dashboard/evaluation-criteria', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(criteria)
  });
};
```

## Setup Instructions

### 1. Create Database Table

Run the migration script:

```bash
cd backend
python create_evaluation_criteria_table.py
```

### 2. Verify Installation

Check that the table was created:

```bash
python test_db_connection.py
```

### 3. Test API Endpoints

```bash
# Get criteria (returns defaults if none exist)
curl -X GET http://localhost:5000/recruiter-dashboard/evaluation-criteria \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update criteria
curl -X POST http://localhost:5000/recruiter-dashboard/evaluation-criteria \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"technical_skill":60,"psychometric_assessment":10,"soft_skill":20,"fairplay":10}'

# Reset to defaults
curl -X POST http://localhost:5000/recruiter-dashboard/evaluation-criteria/reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Access Frontend

1. Navigate to Settings page: `/admin/settings`
2. Scroll to "Evaluation Criteria" section
3. Customize parameters as needed
4. Click "Save Criteria" to persist changes

## Use Cases

### Scenario 1: Technical Role
For a senior developer position, increase technical weight:
- Technical Skill: **70%**
- Psychometric Assessment: **10%**
- Soft Skills: **10%**
- Fairplay: **10%**

### Scenario 2: Leadership Role
For a team lead position, balance skills and personality:
- Technical Skill: **40%**
- Psychometric Assessment: **25%**
- Soft Skills: **25%**
- Fairplay: **10%**

### Scenario 3: High-Security Role
For positions requiring absolute integrity:
- Technical Skill: **45%**
- Psychometric Assessment: **15%**
- Soft Skills: **10%**
- Fairplay: **30%**

## Error Handling

### Frontend Errors
- Invalid percentages: Toast notification with error details
- Network errors: Graceful fallback with error message
- Loading states: Disabled buttons during API calls

### Backend Errors
- Missing fields: 400 Bad Request with specific field names
- Invalid sum: 400 Bad Request with current total
- Database errors: 500 Server Error with rollback
- Unauthorized access: 401/403 with appropriate message

## Future Enhancements

1. **Preset Templates**: Save and load common criteria configurations
2. **Role-Based Defaults**: Different defaults based on job role
3. **Historical Tracking**: View changes over time
4. **Analytics**: Compare candidate scores under different criteria
5. **Bulk Update**: Apply criteria to multiple recruiters
6. **Export/Import**: Share criteria configurations

## Security Considerations

- All endpoints require recruiter authentication
- JWT token validation on every request
- SQL injection prevention via ORM
- Input validation on both frontend and backend
- Unique constraint prevents duplicate entries per recruiter

## Testing

### Manual Testing Checklist

- [ ] Create new criteria with custom values
- [ ] Update existing criteria
- [ ] Reset to defaults
- [ ] Verify validation (sum must equal 100)
- [ ] Test with invalid values (negative, >100)
- [ ] Test unauthorized access
- [ ] Verify database persistence
- [ ] Check UI responsiveness
- [ ] Test toast notifications

### Sample Test Data

```json
{
  "valid_criteria": {
    "technical_skill": 55,
    "psychometric_assessment": 15,
    "soft_skill": 15,
    "fairplay": 15
  },
  "invalid_sum": {
    "technical_skill": 60,
    "psychometric_assessment": 20,
    "soft_skill": 20,
    "fairplay": 20
  },
  "invalid_range": {
    "technical_skill": 150,
    "psychometric_assessment": -10,
    "soft_skill": 15,
    "fairplay": 15
  }
}
```

## Support

For issues or questions:
1. Check API response error messages
2. Verify authentication token is valid
3. Ensure percentages sum to 100
4. Check browser console for frontend errors
5. Review backend logs for server errors
