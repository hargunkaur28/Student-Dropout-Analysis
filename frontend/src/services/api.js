import axios from 'axios'

// Default to backend's configured port (5000) unless overridden
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

console.log('API Base URL:', API_BASE_URL) // Debug log

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    console.log('🔑 Adding auth token to request:', config.url, 'Token:', token.substring(0, 20) + '...')
  } else {
    console.log('⚠️ No token found for request:', config.url)
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.data)
    return response
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.data || error.message)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

// Students API
export const studentsAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  getRiskAnalysis: (id) => api.get(`/students/${id}/risk-analysis`),
  getNextRollNumber: (section) => api.get(`/students/next-roll-number/${section}`),
  getObservations: (studentId) => api.get(`/admin/students/${studentId}/observations`),
  createObservation: (data) => api.post('/admin/observations', data),
  bulkUpload: (formData) => {
    return api.post('/students/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
}

// Analytics API
export const analyticsAPI = {
  getDashboard: () => {
    console.log('🔄 Calling dashboard API...');
    return api.get('/analytics/dashboard');
  },
  getUserStats: () => api.get('/analytics/user-stats'),
  getRiskDistribution: () => api.get('/analytics/risk-distribution'),
  getAttendanceTrend: (params) => api.get('/analytics/attendance-trend', { params }),
  getClassPerformance: () => api.get('/analytics/class-performance'),
  getHighRiskStudents: () => api.get('/analytics/high-risk-students'),
}

// Attendance API
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  markAttendance: (data) => api.post('/attendance', data),
  bulkMark: (data) => api.post('/attendance/bulk', data),
  getByStudent: (studentId, params) => api.get(`/attendance/student/${studentId}`, { params }),
}

// Grades API
export const gradesAPI = {
  getAll: (params) => api.get('/grades', { params }),
  create: (data) => api.post('/grades', data),
  update: (id, data) => api.put(`/grades/${id}`, data),
  delete: (id) => api.delete(`/grades/${id}`),
  getByStudent: (studentId) => api.get(`/grades/student/${studentId}`),
}

// Interventions API
export const interventionsAPI = {
  getAll: (params) => api.get('/interventions', { params }),
  getById: (id) => api.get(`/interventions/${id}`),
  create: (data) => api.post('/interventions', data),
  update: (id, data) => api.put(`/interventions/${id}`, data),
  delete: (id) => api.delete(`/interventions/${id}`),
  getByStudent: (studentId) => api.get(`/interventions/student/${studentId}`),
}

// Reports API
export const reportsAPI = {
  generate: (type, params) => api.post(`/reports/${type}`, params, {
    responseType: 'blob'
  }),
  getHistory: () => api.get('/reports/history'),
  schedule: (type, options) => api.post('/reports/schedule', {
    reportType: type,
    reportOptions: options,
  }),
}

// Notifications API
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
}

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  updateStatus: (id, isActive) => api.put(`/users/${id}/status`, { isActive }),
  assignClasses: (teacherId, classes) => api.put(`/users/${teacherId}`, { assignedClasses: classes }),
}

// Admin API
export const adminAPI = {
  // Observations
  createObservation: (data) => api.post('/admin/observations', data),
  getStudentObservations: (studentId) => api.get(`/admin/students/${studentId}/observations`),

  // Communications
  sendCommunication: (data) => api.post('/admin/communications', data),
}

// Parent API
export const parentAPI = {
  // Dashboard
  getDashboard: () => api.get('/parent/dashboard'),

  // Student data
  getStudentAttendance: (studentId, params) => api.get(`/parent/students/${studentId}/attendance`, { params }),
  getStudentAcademic: (studentId) => api.get(`/parent/students/${studentId}/academic`),
  getStudentRisk: (studentId) => api.get(`/parent/students/${studentId}/risk`),
  getStudentInterventions: (studentId) => api.get(`/parent/students/${studentId}/interventions`),

  // Communications
  getCommunications: (params) => api.get('/parent/communications', { params }),
  replyToCommunication: (communicationId, data) => api.post(`/parent/communications/${communicationId}/reply`, data),
  markCommunicationAsRead: (communicationId) => api.put(`/parent/communications/${communicationId}/read`),

  // Profile
  updateProfile: (data) => api.put('/parent/profile', data),

  // Admin: Link students to parent
  linkStudents: (parentId, studentIds) => api.post('/parent/link-students', { parentId, studentIds }),
}

// Meetings API
export const meetingsAPI = {
  getAll: (params) => api.get('/meetings', { params }),
  getById: (id) => api.get(`/meetings/${id}`),
  create: (data) => api.post('/meetings', data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  confirm: (id) => api.post(`/meetings/${id}/confirm`),
  cancel: (id, reason) => api.post(`/meetings/${id}/cancel`, { reason }),
  delete: (id) => api.delete(`/meetings/${id}`),
}

// Teacher API
export const teacherAPI = {
  getDashboard: () => {
    console.log('🔄 Calling teacher dashboard API...')
    const token = localStorage.getItem('token')
    console.log('🔑 Using token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN')
    return api.get('/teacher/dashboard', { timeout: 10000 }) // 10 second timeout
      .then(response => {
        console.log('✅ Teacher dashboard API success:', response)
        return response
      })
      .catch(error => {
        console.error('❌ Teacher dashboard API error:', error)
        if (error.code === 'ECONNABORTED') {
          console.error('❌ Request timed out')
          throw new Error('Request timed out. Please try again.')
        }
        console.error('❌ Error response:', error.response)
        console.error('❌ Error status:', error.response?.status)
        console.error('❌ Error data:', error.response?.data)
        throw error
      })
  },
  getClassStudents: (className) => api.get(`/teacher/classes/${className}/students`),
  getAtRiskStudents: () => api.get('/teacher/students/at-risk'),
  getStudentProfile: (studentId) => api.get(`/teacher/students/${studentId}/profile`),

  // Attendance
  getClassAttendance: (className, date) => api.get(`/teacher/classes/${className}/attendance`, {
    params: { date }
  }),
  markBulkAttendance: (data) => api.post('/teacher/attendance/bulk', data),
  getAttendanceSummary: (className, startDate, endDate) => api.get(`/teacher/classes/${className}/attendance/summary`, {
    params: { startDate, endDate }
  }),
  getStudentAttendanceTrends: (studentId, months) => api.get(`/teacher/students/${studentId}/attendance/trends`, {
    params: { months }
  }),

  // Academic Performance
  submitAcademicGrades: (data) => api.post('/teacher/academic/grades', data),
  getSavedExams: () => api.get('/teacher/academic/exams'),
  getExamDetails: (examId) => api.get(`/teacher/academic/exams/${examId}`),

  // Observations
  getObservations: (params) => api.get('/teacher/observations', { params }),
  createObservation: (data) => api.post('/teacher/observations', data),
  updateObservation: (observationId, data) => api.put(`/teacher/observations/${observationId}`, data),
  deleteObservation: (observationId) => api.delete(`/teacher/observations/${observationId}`),
  getStudentObservations: (studentId) => api.get(`/teacher/students/${studentId}/observations`),

  // Communications
  getCommunications: (params) => api.get('/teacher/communications', { params }),
  sendCommunication: (data) => api.post('/teacher/communications', data),
  getStudentCommunications: (studentId) => api.get(`/teacher/students/${studentId}/communications`),
  updateCommunicationStatus: (communicationId, data) => api.put(`/teacher/communications/${communicationId}/status`, data),
}

// Communications API (for contacting parents)
export const communicationsAPI = {
  sendEmail: (data) => api.post('/communications/send-email', data),
  sendSMS: (data) => api.post('/communications/send-sms', data),
  sendReport: (data) => api.post('/communications/send-report', data),
  getHistory: (studentId) => api.get(`/communications/history/${studentId}`),
}

export default api