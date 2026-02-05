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
    // Get token from localStorage (try both candidate and recruiter tokens)
    const candidateToken = localStorage.getItem('candidate_token');
    const recruiterToken = localStorage.getItem('recruiterToken');
    const token = candidateToken || recruiterToken;

    // Build headers with authentication if token exists
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for JSON requests (not FormData)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add Authorization header if token exists and not already provided
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
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

  /** Finish assessment and generate rationale */
  finishAssessment: async () => {
    const token = localStorage.getItem('candidate_token');
    return request('/api/assessment/finish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// ============ Recruiter Endpoints ============

export const recruiterApi = {
  /** Login recruiter */
  login: async (email: string, password: string) => {
    return request('/api/recruiter/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /** Verify JWT token */
  verifyToken: async () => {
    return request('/api/recruiter/verify', {
      method: 'GET',
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
    const token = localStorage.getItem('recruiterToken');
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
  /** Get all MCQ questions (without correct answers) */
  getQuestions: async () => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request('/api/mcq/questions', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /** Submit answer and get immediate feedback */
  submitAnswer: async (questionId: number, selectedOption: number) => {
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
        selected_option: selectedOption,
      }),
    });
  },

  /** Get current MCQ result/score */
  getResult: async () => {
    const token = localStorage.getItem('candidate_token');
    if (!token) {
      return { data: null, error: 'No authentication token found' };
    }

    return request('/api/mcq/result', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// ============ Psychometric Endpoints ============

export const psychometricApi = {
  /** Load questions into database (one-time setup) */
  loadQuestions: async () => {
    const token = localStorage.getItem('recruiterToken');
    return request('/api/psychometric/load-questions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /** Get all psychometric questions (for recruiter) */
  getAllQuestions: async () => {
    const token = localStorage.getItem('recruiterToken');
    return request('/api/psychometric/questions/all', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /** Set test configuration (recruiter) */
  setConfig: async (recruiterId: number, numQuestions: number, selectionMode: 'random' | 'manual', selectedQuestionIds?: number[], desiredTraits?: number[]) => {
    // recruiterId parameter kept for backwards compatibility but not sent to backend
    // Backend extracts recruiter_id from JWT token
    const token = localStorage.getItem('recruiterToken');
    return request('/api/psychometric/config/set', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        num_questions: numQuestions,
        selection_mode: selectionMode,
        selected_question_ids: selectedQuestionIds,
        desired_traits: desiredTraits,
      }),
    });
  },

  /** Get current test configuration */
  getCurrentConfig: async (recruiterId: number) => {
    // recruiterId parameter kept for backwards compatibility but not sent to backend
    // Backend extracts recruiter_id from JWT token
    const token = localStorage.getItem('recruiterToken');
    return request('/api/psychometric/config/current', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /** Start psychometric test (candidate) */
  startTest: async (candidateId: number) => {
    // candidateId parameter kept for backwards compatibility but not sent to backend
    // Backend extracts candidate_id from JWT token
    return request('/api/psychometric/test/start', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /** Submit psychometric test answers */
  submitTest: async (candidateId: number, answers: { question_id: number; answer: number }[]) => {
    // candidateId parameter kept for backwards compatibility but not sent to backend
    // Backend extracts candidate_id from JWT token
    return request('/api/psychometric/test/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: answers,
      }),
    });
  },

  /** Get candidate results */
  getResults: async (candidateId: number) => {
    return request(`/api/psychometric/results/${candidateId}`, {
      method: 'GET',
    });
  },
};

export default {
  candidate: candidateApi,
  recruiter: recruiterApi,
  admin: adminApi,
  mcq: mcqApi,
  psychometric: psychometricApi,
};
