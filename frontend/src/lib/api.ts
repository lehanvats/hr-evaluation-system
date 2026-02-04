/**
 * API Client for Flask Backend
 * Backend runs on port 5000
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ============ Candidate Endpoints ============

export const candidateApi = {
  /** Login candidate */
  login: async (email: string, password: string) => {
    return request('/api/candidate/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /** Verify JWT token */
  verifyToken: async () => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No token found' };
    }

    return request('/api/candidate/verify', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /** Upload resume for evaluation */
  uploadResume: async (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    // TODO: Implement actual upload
    return request('/api/candidates/upload', {
      method: 'POST',
      body: formData,
    });
  },

  /** Get assessment questions */
  getAssessment: async (assessmentId: string) => {
    return request(`/api/assessments/${assessmentId}`);
  },

  /** Submit assessment answers */
  submitAssessment: async (assessmentId: string, answers: Record<string, unknown>) => {
    return request(`/api/assessments/${assessmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify(answers),
    });
  },
};

// ============ Admin/Recruiter Endpoints ============

export const adminApi = {
  /** Get all candidates */
  getCandidates: async () => {
    return request('/api/admin/candidates');
  },

  /** Get single candidate details */
  getCandidate: async (candidateId: string) => {
    return request(`/api/admin/candidates/${candidateId}`);
  },

  /** Upload candidates from CSV/Excel file */
  uploadCandidates: async (file: File) => {
    const token = localStorage.getItem('recruiter_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/recruiter/candidates/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.message || 'Upload failed' };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'An error occurred during upload',
      };
    }
  },

  /** Get analytics dashboard data */
  getAnalytics: async () => {
    return request('/api/admin/analytics');
  },

  /** Update settings */
  updateSettings: async (settings: Record<string, unknown>) => {
    return request('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// ============ MCQ Endpoints ============

export const mcqApi = {
  /** Submit a single MCQ answer */
  submitAnswer: async (questionId: number, answerOption: string) => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request('/api/mcq/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        question_id: questionId,
        answer_option: answerOption,
      }),
    });
  },

  /** Submit multiple MCQ answers at once */
  batchSubmit: async (answers: Array<{ question_id: number; answer_option: string }>) => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request('/api/mcq/batch-submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ answers }),
    });
  },

  /** Complete MCQ round and lock it */
  completeRound: async (answers: Array<{ question_id: number; answer_option: string }>) => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request('/api/mcq/complete-round', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ answers }),
    });
  },

  /** Get all MCQ responses for the candidate */
  getResponses: async () => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request('/api/mcq/responses', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /** Get MCQ response for a specific question */
  getResponse: async (questionId: number) => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request(`/api/mcq/responses/${questionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

export default {
  candidate: candidateApi,
  admin: adminApi,
  mcq: mcqApi,
};
